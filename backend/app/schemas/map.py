from datetime import date as date_t
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class MapExpense(BaseModel):
    id: UUID
    description: str | None
    amount: Decimal
    currency: str
    category: str
    date: date_t
    location_lat: Decimal
    location_lng: Decimal
    location_name: str | None


class MapLegPoint(BaseModel):
    lat: Decimal
    lng: Decimal
    label: str


class MapLeg(BaseModel):
    id: UUID
    mode: str
    points: list[MapLegPoint]


class TripMapData(BaseModel):
    expenses: list[MapExpense]
    legs: list[MapLeg]
