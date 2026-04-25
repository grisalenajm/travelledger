import re
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator

_VALID_CURRENCIES = {
    "AED", "ARS", "AUD", "BRL", "CAD", "CHF", "CLP", "CNY",
    "COP", "CZK", "DKK", "EUR", "GBP", "HKD", "HUF", "IDR",
    "ILS", "INR", "JPY", "KRW", "MXN", "MYR", "NOK", "NZD",
    "PEN", "PHP", "PLN", "RON", "RUB", "SAR", "SEK", "SGD",
    "THB", "TRY", "TWD", "UAH", "USD", "ZAR",
}

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
    telegram_chat_id: str | None

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: str | None = None
    currency_base: str | None = None

    @field_validator("currency_base")
    @classmethod
    def upper_currency(cls, v: str | None) -> str | None:
        return _validate_currency(v) if v else v


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    refresh_token: str


class DeviceRegister(BaseModel):
    fcm_token: str
