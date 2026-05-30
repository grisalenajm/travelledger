from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class NotificationRead(BaseModel):
    id: UUID
    type: str
    title: str
    message: str | None
    read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationCount(BaseModel):
    unread: int
