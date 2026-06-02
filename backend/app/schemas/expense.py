from datetime import date as date_t, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, computed_field, field_validator

ExpenseCategory = Literal[
    "Dining", "Lodging", "Transport", "Culture", "Shopping", "Health", "Other"
]

VALID_CURRENCIES = {
    "AED", "ARS", "AUD", "BRL", "CAD", "CHF", "CLP", "CNY",
    "COP", "CZK", "DKK", "EUR", "GBP", "HKD", "HUF", "IDR",
    "ILS", "INR", "JPY", "KRW", "MXN", "MYR", "NOK", "NZD",
    "PEN", "PHP", "PLN", "RON", "RUB", "SAR", "SEK", "SGD",
    "THB", "TRY", "TWD", "UAH", "USD", "ZAR",
}


class ExpenseCreate(BaseModel):
    id: UUID | None = None
    trip_id: UUID
    amount: Decimal = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3)
    category: ExpenseCategory
    date: date_t
    description: str | None = None
    payment_method_id: UUID | None = None
    billable: bool = True  # CRÍTICO: default True
    loyalty_card_id: UUID | None = None
    location_name: str | None = None

    @field_validator("currency", mode="before")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        v = v.upper()
        if v not in VALID_CURRENCIES:
            raise ValueError(f"Currency '{v}' is not supported")
        return v

    @field_validator("payment_method_id", "loyalty_card_id", mode="before")
    @classmethod
    def empty_str_uuid_to_none(cls, v: object) -> object:
        if v == "" or v == "null" or v is None:
            return None
        return v


class ExpenseUpdate(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    category: ExpenseCategory | None = None
    date: date_t | None = None
    description: str | None = None
    payment_method_id: UUID | None = None
    billable: bool | None = None
    loyalty_card_id: UUID | None = None
    is_draft: bool | None = None
    location_name: str | None = None
    location_lat: Decimal | None = None
    location_lng: Decimal | None = None

    @field_validator("payment_method_id", "loyalty_card_id", mode="before")
    @classmethod
    def empty_str_uuid_to_none(cls, v: object) -> object:
        if v == "" or v == "null" or v is None:
            return None
        return v

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
    payment_method_id: UUID | None = None
    billable: bool
    loyalty_card_id: UUID | None
    paperless_doc_id: int | None
    is_draft: bool
    ocr_confidence: float | None
    created_at: datetime
    updated_at: datetime
    local_path: str | None = Field(default=None, exclude=True)
    location_lat: Decimal | None = None
    location_lng: Decimal | None = None
    location_name: str | None = None

    @computed_field
    @property
    def has_receipt(self) -> bool:
        return self.paperless_doc_id is not None or self.local_path is not None

    model_config = {"from_attributes": True}
