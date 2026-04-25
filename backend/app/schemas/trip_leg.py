from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

LegMode = Literal["flight", "train", "car", "bus", "ferry", "other"]


class TripLegCreate(BaseModel):
    mode: LegMode
    origin: str = Field(max_length=100)
    destination: str = Field(max_length=100)
    departure_local: datetime  # naive, sin TZ
    arrival_local: datetime    # naive, sin TZ
    carrier: str | None = Field(default=None, max_length=100)
    reservation_number: str | None = Field(default=None, max_length=50)
    locator_code: str | None = Field(default=None, max_length=20)
    loyalty_card_id: UUID | None = None
    notes: str | None = None


class TripLegUpdate(BaseModel):
    mode: LegMode | None = None
    origin: str | None = Field(default=None, max_length=100)
    destination: str | None = Field(default=None, max_length=100)
    departure_local: datetime | None = None
    arrival_local: datetime | None = None
    carrier: str | None = None
    reservation_number: str | None = None
    locator_code: str | None = None
    loyalty_card_id: UUID | None = None
    notes: str | None = None


class TripLegRead(TripLegCreate):
    id: UUID
    trip_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
