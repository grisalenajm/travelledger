from datetime import datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, computed_field, field_validator

LegMode = Literal["flight", "accommodation", "car_rental", "train", "bus", "ferry", "other"]


class TripLegBase(BaseModel):
    mode: LegMode
    notes: str | None = None
    expense_id: UUID | None = None

    @field_validator(
        "expense_id", "loyalty_card_id",
        mode="before",
    )
    @classmethod
    def empty_str_to_none(cls, v: Any) -> Any:
        if v == "" or v == "null" or v is None:
            return None
        return v

    @field_validator(
        "departure_local", "arrival_local",
        "check_in", "check_out",
        "pickup_datetime", "dropoff_datetime",
        mode="before",
    )
    @classmethod
    def empty_str_datetime_to_none(cls, v: Any) -> Any:
        if v == "" or v is None:
            return None
        return v

    @field_validator(
        "origin_lat", "origin_lng",
        "destination_lat", "destination_lng",
        "accommodation_lat", "accommodation_lng",
        "pickup_lat", "pickup_lng",
        "dropoff_lat", "dropoff_lng",
        "distance_km",
        mode="before",
    )
    @classmethod
    def empty_str_decimal_to_none(cls, v: Any) -> Any:
        if v == "" or v is None:
            return None
        return v

    # Transporte (flight | train | bus | ferry | other)
    origin: str | None = Field(default=None, max_length=100)
    destination: str | None = Field(default=None, max_length=100)
    origin_lat: Decimal | None = None
    origin_lng: Decimal | None = None
    destination_lat: Decimal | None = None
    destination_lng: Decimal | None = None
    departure_local: datetime | None = None
    arrival_local: datetime | None = None
    carrier: str | None = Field(default=None, max_length=100)
    flight_number: str | None = Field(default=None, max_length=20)
    reservation_number: str | None = Field(default=None, max_length=50)
    locator_code: str | None = Field(default=None, max_length=20)
    seat: str | None = Field(default=None, max_length=10)
    distance_km: Decimal | None = None
    loyalty_card_id: UUID | None = None

    # Alojamiento
    accommodation_name: str | None = Field(default=None, max_length=200)
    accommodation_address: str | None = None
    accommodation_lat: Decimal | None = None
    accommodation_lng: Decimal | None = None
    accommodation_provider: str | None = Field(default=None, max_length=100)
    check_in: datetime | None = None
    check_out: datetime | None = None

    # Alquiler de coche
    rental_company: str | None = Field(default=None, max_length=100)
    pickup_location: str | None = Field(default=None, max_length=200)
    pickup_lat: Decimal | None = None
    pickup_lng: Decimal | None = None
    dropoff_location: str | None = Field(default=None, max_length=200)
    dropoff_lat: Decimal | None = None
    dropoff_lng: Decimal | None = None
    pickup_datetime: datetime | None = None
    dropoff_datetime: datetime | None = None
    confirmation_number: str | None = Field(default=None, max_length=50)


class TripLegCreate(TripLegBase):
    pass


class TripLegUpdate(TripLegBase):
    mode: LegMode | None = None


class TripLegRead(TripLegBase):
    id: UUID
    trip_id: UUID | None = None
    user_id: UUID | None = None
    source: str | None = None
    confirmed: bool = True
    created_at: datetime
    updated_at: datetime
    # Loaded from ORM but not serialised to JSON (internal path stays server-side)
    document_path: str | None = Field(default=None, exclude=True)

    @computed_field
    @property
    def has_document(self) -> bool:
        return self.document_path is not None

    model_config = {"from_attributes": True}
