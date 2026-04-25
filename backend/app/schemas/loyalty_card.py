from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

ProgramType = Literal["airline", "train", "hotel", "car_rental", "other"]


class LoyaltyCardCreate(BaseModel):
    program_name: str = Field(max_length=100)
    program_type: ProgramType
    membership_number: str = Field(max_length=50)
    tier: str | None = Field(default=None, max_length=30)
    alias: str | None = Field(default=None, max_length=50)


class LoyaltyCardUpdate(BaseModel):
    tier: str | None = Field(default=None, max_length=30)
    alias: str | None = Field(default=None, max_length=50)


class LoyaltyCardRead(LoyaltyCardCreate):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
