import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import JWTError
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.dependencies import get_current_user
from app.core.limiter import limiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.models.user import User
from app.schemas.auth import DeviceRegister, Token, TokenRefresh, UserCreate, UserLogin, UserRead

logger = logging.getLogger(__name__)
security_logger = logging.getLogger("security")

router = APIRouter(prefix="/api/auth", tags=["auth"])


class InviteValidate(BaseModel):
    code: str


@router.post("/validate-invite")
async def validate_invite(data: InviteValidate):
    """Valida el invite code sin crear usuario. Usado por la app Android en ConfigScreen."""
    if data.code != settings.REGISTRATION_INVITE_CODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid invite code",
        )
    return {"valid": True}


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(request: Request, payload: UserCreate, db: AsyncSession = Depends(get_db)):
    if payload.invite_code != settings.REGISTRATION_INVITE_CODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid invite code",
        )
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(
        email=payload.email,
        name=payload.name,
        password_hash=hash_password(payload.password),
        currency_base=payload.currency_base,
    )
    db.add(user)
    await db.flush()
    security_logger.info("user_registered", extra={"email": payload.email, "ip": request.client.host})
    return user


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login(request: Request, payload: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        security_logger.warning(
            "login_failed",
            extra={"email": payload.email, "ip": request.client.host},
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    security_logger.info(
        "login_success",
        extra={"user_id": str(user.id), "ip": request.client.host},
    )
    return Token(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/refresh", response_model=Token)
@limiter.limit("20/minute")
async def refresh(request: Request, payload: TokenRefresh, db: AsyncSession = Depends(get_db)):
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    try:
        data = decode_token(payload.refresh_token)
        if data.get("type") != "refresh":
            raise exc
        user_id = data.get("sub")
        if not user_id:
            raise exc
    except JWTError:
        raise exc

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise exc
    return Token(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(current_user: User = Depends(get_current_user)):
    # JWT es stateless — el cliente descarta el token
    pass


@router.post("/device", status_code=status.HTTP_204_NO_CONTENT)
async def register_device(
    payload: DeviceRegister,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.fcm_token = payload.fcm_token
    db.add(current_user)
