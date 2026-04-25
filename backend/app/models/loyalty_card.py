from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LoyaltyCard(Base):
    __tablename__ = "loyalty_cards"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    program_name: Mapped[str] = mapped_column(String(100), nullable=False)
    program_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # valores: airline | train | hotel | car_rental | other
    membership_number: Mapped[str] = mapped_column(String(50), nullable=False)
    tier: Mapped[str | None] = mapped_column(String(30))
    alias: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
