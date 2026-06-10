import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_admin, require_not_guest
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    AcceptInvitePayload,
    InviteTokenInfo,
    SetPasswordPayload,
    Token,
    UserAdminRead,
    UserInvite,
    UserRead,
    UserRoleUpdate,
    UserUpdate,
)
from app.services import user_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/users", tags=["users"])

_REFRESH_COOKIE = "refresh_token"
_REFRESH_MAX_AGE = 7 * 24 * 60 * 60  # 7 days


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=_REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=_REFRESH_MAX_AGE,
        path="/api",
    )


def _to_admin_read(user: User) -> UserAdminRead:
    """Convierte un ORM User a UserAdminRead calculando has_pending_invite."""
    has_pending = bool(
        user.invite_token is not None
        and user.invite_token_expires_at is not None
        and user.invite_token_expires_at > datetime.now(timezone.utc)
    )
    return UserAdminRead(
        id=user.id,
        email=user.email,
        name=user.name,
        is_admin=user.is_admin,
        is_guest=user.is_guest,
        is_active=user.is_active,
        must_change_password=user.must_change_password,
        has_pending_invite=has_pending,
        invited_by=user.invited_by,
        created_at=user.created_at,
    )


# ────────────────────────────────────────────────────────────────────────────────
# Endpoints propios del usuario autenticado
# ────────────────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserRead)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserRead)
async def update_me(
    payload: UserUpdate,
    current_user: User = Depends(require_not_guest),
    db: AsyncSession = Depends(get_db),
):
    if payload.name is not None:
        current_user.name = payload.name
    if payload.currency_base is not None:
        current_user.currency_base = payload.currency_base

    if payload.password_new is not None:
        # No se requiere contraseña actual si must_change_password=True
        if not current_user.must_change_password:
            if not payload.password_current:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Se requiere la contraseña actual para cambiarla",
                )
            if not verify_password(payload.password_current, current_user.password_hash):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La contraseña actual es incorrecta",
                )
        current_user.password_hash = hash_password(payload.password_new)
        current_user.must_change_password = False

    db.add(current_user)
    return current_user


@router.post("/set-password", status_code=status.HTTP_204_NO_CONTENT)
async def force_set_password(
    payload: SetPasswordPayload,
    current_user: User = Depends(require_not_guest),
    db: AsyncSession = Depends(get_db),
):
    """Cambio forzado de contraseña — solo disponible cuando must_change_password=True."""
    if not current_user.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No hay cambio de contraseña pendiente para esta cuenta",
        )
    current_user.password_hash = hash_password(payload.password)
    current_user.must_change_password = False
    db.add(current_user)


# ────────────────────────────────────────────────────────────────────────────────
# Endpoints públicos (sin autenticación)
# ────────────────────────────────────────────────────────────────────────────────

@router.get("/invite/{token}", response_model=InviteTokenInfo)
async def get_invite_info(token: str, db: AsyncSession = Depends(get_db)):
    """Valida un token de invitación y devuelve email/nombre (sin revelar datos sensibles)."""
    try:
        user = await user_service.get_invite_info(db, token)
        return InviteTokenInfo(email=user.email, name=user.name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/accept-invite", response_model=Token)
async def accept_invite(
    payload: AcceptInvitePayload,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Acepta una invitación: activa la cuenta y devuelve tokens JWT para auto-login."""
    try:
        user = await user_service.accept_invite(db, payload.token, payload.password, payload.name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    _set_refresh_cookie(response, refresh_token)
    return Token(access_token=access_token, refresh_token=refresh_token)


# ────────────────────────────────────────────────────────────────────────────────
# Endpoints de administración (solo admin)
# ────────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[UserAdminRead])
async def list_users(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Lista todos los usuarios de la instancia."""
    result = await db.execute(select(User).order_by(User.created_at))
    users = result.scalars().all()
    return [_to_admin_read(u) for u in users]


@router.post("/invite", response_model=UserAdminRead, status_code=status.HTTP_201_CREATED)
async def invite_user(
    payload: UserInvite,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Invita a un nuevo usuario enviándole un email con el enlace de activación."""
    try:
        user = await user_service.create_invite(db, admin.id, payload.email, payload.name, payload.is_admin)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return _to_admin_read(user)


@router.post("/{user_id}/resend-invite", status_code=status.HTTP_204_NO_CONTENT)
async def resend_invite(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Regenera el token de invitación y reenvía el email."""
    try:
        await user_service.resend_invite(db, user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.put("/{user_id}/toggle", response_model=UserAdminRead)
async def toggle_user_active(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Activa o desactiva la cuenta de un usuario."""
    try:
        user = await user_service.toggle_active(db, user_id, admin.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return _to_admin_read(user)


@router.put("/{user_id}/role", response_model=UserAdminRead)
async def change_user_role(
    user_id: UUID,
    payload: UserRoleUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Cambia el rol (admin/usuario) de un usuario."""
    try:
        user = await user_service.change_role(db, user_id, payload.is_admin, admin.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return _to_admin_read(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Elimina un usuario de forma permanente."""
    try:
        await user_service.delete_user(db, user_id, admin.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
