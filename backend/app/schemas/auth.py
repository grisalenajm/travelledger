import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator

from app.core.currencies import VALID_CURRENCIES as _VALID_CURRENCIES


# ≥12 chars, at least one uppercase, one lowercase, one digit, one special char
_PASSWORD_RE = re.compile(r'^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$')


def _validate_currency(v: str) -> str:
    v = v.strip().upper()
    if v not in _VALID_CURRENCIES:
        raise ValueError(f"Moneda no soportada: '{v}'. Usa un código ISO 4217 válido.")
    return v


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    currency_base: str = "EUR"

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not _PASSWORD_RE.match(v):
            raise ValueError(
                "La contraseña debe tener ≥12 caracteres, "
                "mayúscula, minúscula, número y carácter especial."
            )
        return v

    @field_validator("currency_base")
    @classmethod
    def upper_currency(cls, v: str) -> str:
        return _validate_currency(v)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    id: UUID
    email: str
    name: str
    currency_base: str
    is_admin: bool = False
    is_guest: bool = False
    must_change_password: bool = False
    guest_of: UUID | None = None
    telegram_chat_id: str | None = None

    model_config = {"from_attributes": True}


class UserAdminRead(BaseModel):
    """Schema de lectura para el panel de admin — incluye campos sensibles de gestión."""
    id: UUID
    email: str
    name: str
    is_admin: bool
    is_guest: bool
    is_active: bool
    must_change_password: bool
    has_pending_invite: bool
    invited_by: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: str | None = None
    currency_base: str | None = None
    password_current: str | None = None
    password_new: str | None = None

    @field_validator("currency_base")
    @classmethod
    def upper_currency(cls, v: str | None) -> str | None:
        return _validate_currency(v) if v else v

    @field_validator("password_new")
    @classmethod
    def validate_new_password(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not _PASSWORD_RE.match(v):
            raise ValueError(
                "La contraseña debe tener ≥12 caracteres, "
                "mayúscula, minúscula, número y carácter especial."
            )
        return v


# ── Invitaciones ────────────────────────────────────────────────────────────────

class UserInvite(BaseModel):
    """Payload para invitar a un nuevo usuario."""
    email: EmailStr
    name: str
    is_admin: bool = False


class AcceptInvitePayload(BaseModel):
    """Payload para aceptar una invitación y activar la cuenta."""
    token: str
    password: str
    name: str | None = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not _PASSWORD_RE.match(v):
            raise ValueError(
                "La contraseña debe tener ≥12 caracteres, "
                "mayúscula, minúscula, número y carácter especial."
            )
        return v


class InviteTokenInfo(BaseModel):
    """Respuesta pública para validar un token de invitación."""
    email: str
    name: str


class UserRoleUpdate(BaseModel):
    """Payload para cambiar el rol de un usuario."""
    is_admin: bool


class SetPasswordPayload(BaseModel):
    """Payload para cambio forzado de contraseña (must_change_password=True)."""
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not _PASSWORD_RE.match(v):
            raise ValueError(
                "La contraseña debe tener ≥12 caracteres, "
                "mayúscula, minúscula, número y carácter especial."
            )
        return v


# ── Tokens ──────────────────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    refresh_token: str


class DeviceRegister(BaseModel):
    fcm_token: str
