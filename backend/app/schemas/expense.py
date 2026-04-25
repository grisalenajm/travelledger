from datetime import date as date_t, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

ExpenseCategory = Literal[
    "Dining", "Lodging", "Transport", "Culture", "Shopping", "Health", "Other"
]
PaymentMethod = Literal["card", "cash", "transfer", "other"]

VALID_CURRENCIES = {
    "AED", "ARS", "AUD", "BRL", "CAD", "CHF", "CLP", "CNY",
    "COP", "CZK", "DKK", "EUR", "GBP", "HKD", "HUF", "IDR",
    "ILS", "INR", "JPY", "KRW", "MXN", "MYR", "NOK", "NZD",
    "PEN", "PHP", "PLN", "RON", "RUB", "SAR", "SEK", "SGD",
    "THB", "TRY", "TWD", "UAH", "USD", "ZAR",
}


class ExpenseCreate(BaseModel):
    trip_id: UUID
    amount: Decimal = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3)
    category: ExpenseCategory
    date: date_t
    description: str | None = None
    payment_method: PaymentMethod | None = None
    billable: bool = True  # CRÍTICO: default True
    loyalty_card_id: UUID | None = None

    @field_validator("currency", mode="before")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        v = v.upper()
        if v not in VALID_CURRENCIES:
            raise ValueError(f"Currency '{v}' is not supported")
        return v


class ExpenseUpdate(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    category: ExpenseCategory | None = None
    date: date_t | None = None
    description: str | None = None
    payment_method: PaymentMethod | None = None
    billable: bool | None = None
    loyalty_card_id: UUID | None = None

    @field_validator("currency", mode="before")
    @classmethod
    def validate_currency(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.upper()
        if v not in VALID_CURRENCIES:
            raise ValueError(f"Currency '{v}' is not supported")
        return v


class ExpenseRead(BaseModel):
    id: UUID
    trip_id: UUID
    user_id: UUID
    amount: Decimal
    currency: str
    amount_base: Decimal
    rate_date: date_t
    category: ExpenseCategory
    description: str | None
    date: date_t
    payment_method: PaymentMethod | None
    billable: bool
    loyalty_card_id: UUID | None
    paperless_doc_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
