import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jose import JWTError
from sqlalchemy import func, select
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
from app.schemas.auth import DeviceRegister, Token, UserCreate, UserLogin, UserRead

logger = logging.getLogger(__name__)
security_logger = logging.getLogger("security")

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/status")
async def auth_status(db: AsyncSession = Depends(get_db)):
    """Public endpoint — no auth required. Returns registration state."""
    count = (await db.execute(select(func.count(User.id)))).scalar_one()
    has_users = count > 0
    registration_open = not has_users or settings.ALLOW_REGISTRATION
    return {"registration_open": registration_open, "has_users": has_users}


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(request: Request, payload: UserCreate, db: AsyncSession = Depends(get_db)):
    count = (await db.execute(select(func.count(User.id)))).scalar_one()
    has_users = count > 0

    if has_users and not settings.ALLOW_REGISTRATION:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El registro está cerrado. Contacta con el administrador.",
        )

    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=payload.email,
        name=payload.name,
        password_hash=hash_password(payload.password),
        currency_base=payload.currency_base,
        is_admin=not has_users,  # first registered user becomes admin
    )
    db.add(user)
    await db.flush()
    security_logger.info("user_registered", extra={"email": payload.email, "ip": request.client.host})
    return user


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


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login(request: Request, response: Response, payload: UserLogin, db: AsyncSession = Depends(get_db)):
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
    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    _set_refresh_cookie(response, refresh_token)
    return Token(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=Token)
@limiter.limit("20/minute")
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    # Cookie-first, body-fallback
    token_value = request.cookies.get(_REFRESH_COOKIE)
    if not token_value:
        try:
            body = await request.json()
            token_value = body.get("refresh_token")
        except Exception:
            token_value = None
    if not token_value:
        raise exc

    try:
        data = decode_token(token_value)
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

    new_access = create_access_token(str(user.id))
    new_refresh = create_refresh_token(str(user.id))
    _set_refresh_cookie(response, new_refresh)
    return Token(access_token=new_access, refresh_token=new_refresh)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response, current_user: User = Depends(get_current_user)):
    response.delete_cookie(
        key=_REFRESH_COOKIE,
        path="/api",
        secure=True,
        httponly=True,
        samesite="lax",
    )


@router.post("/device", status_code=status.HTTP_204_NO_CONTENT)
async def register_device(
    payload: DeviceRegister,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.fcm_token = payload.fcm_token
    db.add(current_user)
