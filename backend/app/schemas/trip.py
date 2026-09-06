from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.currencies import VALID_CURRENCIES

TripStatus = Literal["active", "closed", "draft"]


def _check_currency(v: str) -> str:
    v = v.upper()
    if v not in VALID_CURRENCIES:
        raise ValueError(f"Currency '{v}' is not supported")
    return v


class TripCreate(BaseModel):
    id: UUID | None = None
    name: str = Field(max_length=100)
    description: str | None = None
    destination: str = Field(max_length=100)
    destination_lat: float | None = None
    destination_lng: float | None = None
    start_date: date
    end_date: date
    primary_currency: str = Field(min_length=3, max_length=3)
    budget: Decimal = Field(default=Decimal("0"), ge=0)
    budget_currency: str = Field(default="EUR", min_length=3, max_length=3)
    status: TripStatus = "active"

    @field_validator("primary_currency", "budget_currency", mode="before")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        return _check_currency(v)

    @field_validator("destination_lat", "destination_lng", mode="before")
    @classmethod
    def empty_str_float_to_none(cls, v: object) -> object:
        if v == "" or v is None:
            return None
        return v

    @model_validator(mode="after")
    def end_after_start(self) -> "TripCreate":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class TripUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    description: str | None = None
    destination: str | None = Field(default=None, max_length=100)
    destination_lat: float | None = None
    destination_lng: float | None = None
    start_date: date | None = None
    end_date: date | None = None
    primary_currency: str | None = Field(default=None, min_length=3, max_length=3)
    budget: Decimal | None = Field(default=None, ge=0)
    budget_currency: str | None = Field(default=None, min_length=3, max_length=3)
    status: TripStatus | None = None

    @field_validator("primary_currency", "budget_currency", mode="before")
    @classmethod
    def validate_currency(cls, v: str | None) -> str | None:
        return _check_currency(v) if v else v

    @field_validator("destination_lat", "destination_lng", mode="before")
    @classmethod
    def empty_str_float_to_none(cls, v: object) -> object:
        if v == "" or v is None:
            return None
        return v


class TripRead(TripCreate):
    id: UUID
    user_id: UUID
    cover_doc_id: int | None = None
    cover_image_path: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TripSummary(BaseModel):
    trip_id: UUID
    name: str
    spent_base: Decimal
    budget_base: Decimal
    currency_base: str
    percentage: float
    expense_count: int
    legs_count: int
