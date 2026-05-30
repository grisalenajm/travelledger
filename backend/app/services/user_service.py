"""
user_service.py — Lógica de gestión de usuarios e invitaciones.
"""
import logging
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import hash_password
from app.models.user import User
from app.services import email_service, payment_method_service

logger = logging.getLogger(__name__)

_INVITE_EXPIRES_DAYS = 7


def _make_token() -> str:
    return secrets.token_urlsafe(32)


def _invite_url(token: str) -> str:
    return f"{settings.APP_URL}/invite/{token}"


async def create_invite(
    db: AsyncSession,
    invited_by_id: UUID,
    email: str,
    name: str,
    is_admin: bool = False,
) -> User:
    """Crea un usuario inactivo con token de invitación y envía el email."""
    existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing:
        raise ValueError(f"El email ya está registrado: {email}")

    token = _make_token()
    expires = datetime.now(timezone.utc) + timedelta(days=_INVITE_EXPIRES_DAYS)

    user = User(
        email=email,
        name=name,
        # Contraseña aleatoria inutilizable (el usuario establece la suya al aceptar)
        password_hash=hash_password(secrets.token_hex(32)),
        is_active=False,
        is_admin=is_admin,
        invite_token=token,
        invite_token_expires_at=expires,
        invited_by=invited_by_id,
    )
    db.add(user)
    await db.flush()
    await payment_method_service.seed_defaults(db, user.id)

    url = _invite_url(token)
    try:
        await email_service.send_invite_email(db, invited_by_id, email, name, url)
    except Exception as exc:
        # El fallo de email no debe bloquear la creación del usuario
        logger.warning("create_invite: email send failed for %s: %s", email, exc)

    logger.info("invite_created user_id=%s email=%s by=%s", user.id, email, invited_by_id)
    return user


async def get_invite_info(db: AsyncSession, token: str) -> User:
    """Devuelve el usuario asociado a un token de invitación (para la página /invite/[token])."""
    user = (await db.execute(select(User).where(User.invite_token == token))).scalar_one_or_none()
    if not user:
        raise ValueError("Token inválido o ya utilizado")
    if user.invite_token_expires_at and user.invite_token_expires_at < datetime.now(timezone.utc):
        raise ValueError("El enlace de invitación ha expirado")
    return user


async def accept_invite(
    db: AsyncSession,
    token: str,
    password: str,
    name: str | None = None,
) -> User:
    """Activa la cuenta invitada: establece contraseña y marca is_active=True."""
    user = (await db.execute(select(User).where(User.invite_token == token))).scalar_one_or_none()
    if not user:
        raise ValueError("Token inválido o ya utilizado")
    if user.invite_token_expires_at and user.invite_token_expires_at < datetime.now(timezone.utc):
        raise ValueError("El enlace de invitación ha expirado")

    user.password_hash = hash_password(password)
    user.is_active = True
    user.invite_token = None
    user.invite_token_expires_at = None
    user.must_change_password = False
    if name and name.strip():
        user.name = name.strip()

    db.add(user)
    await db.flush()
    logger.info("invite_accepted user_id=%s email=%s", user.id, user.email)
    return user


async def resend_invite(db: AsyncSession, user_id: UUID) -> User:
    """Regenera el token y reenvía el email de invitación."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise ValueError(f"Usuario no encontrado: {user_id}")
    if user.is_active:
        raise ValueError("El usuario ya está activo — no se puede reenviar la invitación")

    token = _make_token()
    expires = datetime.now(timezone.utc) + timedelta(days=_INVITE_EXPIRES_DAYS)
    user.invite_token = token
    user.invite_token_expires_at = expires
    db.add(user)

    url = _invite_url(token)
    try:
        if user.invited_by:
            await email_service.send_invite_email(db, user.invited_by, user.email, user.name, url)
        else:
            logger.warning("resend_invite: no inviter_id for user %s — omitiendo email", user_id)
    except Exception as exc:
        logger.warning("resend_invite: email send failed for %s: %s", user.email, exc)

    logger.info("invite_resent user_id=%s email=%s", user.id, user.email)
    return user


async def toggle_active(db: AsyncSession, user_id: UUID, admin_id: UUID) -> User:
    """Activa o desactiva un usuario."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise ValueError(f"Usuario no encontrado: {user_id}")
    if user.id == admin_id:
        raise ValueError("No puedes desactivar tu propia cuenta")
    if user.is_guest:
        raise ValueError("No se puede desactivar el usuario guest")
    user.is_active = not user.is_active
    db.add(user)
    logger.info("user_toggled user_id=%s is_active=%s by=%s", user.id, user.is_active, admin_id)
    return user


async def change_role(db: AsyncSession, user_id: UUID, is_admin: bool, admin_id: UUID) -> User:
    """Cambia el rol (admin / usuario) de un usuario."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise ValueError(f"Usuario no encontrado: {user_id}")
    if user.id == admin_id and not is_admin:
        raise ValueError("No puedes quitarte los permisos de administrador a ti mismo")
    if user.is_guest:
        raise ValueError("No se puede cambiar el rol del usuario guest")
    user.is_admin = is_admin
    db.add(user)
    logger.info("role_changed user_id=%s is_admin=%s by=%s", user.id, is_admin, admin_id)
    return user


async def delete_user(db: AsyncSession, user_id: UUID, admin_id: UUID) -> None:
    """Elimina un usuario de forma permanente."""
    if user_id == admin_id:
        raise ValueError("No puedes eliminarte a ti mismo")
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise ValueError(f"Usuario no encontrado: {user_id}")
    if user.is_guest:
        raise ValueError("El usuario guest no se puede eliminar — usa el script de gestión")
    await db.delete(user)
    logger.info("user_deleted user_id=%s by=%s", user_id, admin_id)
