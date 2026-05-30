import hashlib
import hmac
import time
import uuid
from uuid import UUID

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import decode_token
from app.database import get_db
from app.models.user import User

bearer = HTTPBearer()

_BOT_REPLAY_WINDOW = 300  # segundos — ventana anti-replay para requests del bot


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise exc
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise exc
    except JWTError:
        raise exc

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise exc
    # Rechazar acceso si la cuenta está desactivada
    if hasattr(user, "is_active") and not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta desactivada. Contacta con el administrador.",
        )
    return user


def get_effective_user_id(
    current_user: User = Depends(get_current_user),
) -> UUID:
    """Devuelve el user_id efectivo: si es guest devuelve el id del owner."""
    if current_user.is_guest and current_user.guest_of:
        return current_user.guest_of
    return current_user.id


def require_not_guest(
    current_user: User = Depends(get_current_user),
) -> User:
    """Bloquea escritura para usuarios guest."""
    if current_user.is_guest:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Modo solo lectura — operación no permitida",
        )
    return current_user


def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Solo admin puede usar este endpoint."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requieren permisos de administrador",
        )
    return current_user


async def verify_bot_request(
    request: Request,
    x_bot_api_key: str = Header(..., alias="X-Bot-Api-Key"),
    x_timestamp: str = Header(..., alias="X-Timestamp"),
    x_signature: str = Header(..., alias="X-Signature"),
) -> None:
    """
    Dependencia FastAPI para endpoints internos del bot.
    Valida firma HMAC-SHA256 + ventana anti-replay de 5 minutos.

    Uso: router.post("/bot/link", dependencies=[Depends(verify_bot_request)])
    """
    forbidden = HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if x_bot_api_key != settings.BOT_API_KEY:
        raise forbidden

    try:
        ts = int(x_timestamp)
    except ValueError:
        raise forbidden

    if abs(time.time() - ts) > _BOT_REPLAY_WINDOW:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Request expired",
        )

    body = await request.body()
    msg = f"{x_timestamp}.".encode() + body
    expected = hmac.new(settings.BOT_API_KEY.encode(), msg, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected, x_signature):
        raise forbidden
