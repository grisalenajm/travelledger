from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TripLeg(Base):
    __tablename__ = "trip_legs"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    trip_id: Mapped[UUID] = mapped_column(
        ForeignKey("trips.id", ondelete="CASCADE"), nullable=False
    )
    mode: Mapped[str] = mapped_column(String(10), nullable=False)
    # valores: flight | train | car | bus | ferry | other
    origin: Mapped[str] = mapped_column(String(100), nullable=False)
    destination: Mapped[str] = mapped_column(String(100), nullable=False)
    departure_local: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False
    )
    # NAIVE — sin timezone. Hora local del billete. NO convertir a UTC.
    arrival_local: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False
    )
    carrier: Mapped[str | None] = mapped_column(String(100))
    reservation_number: Mapped[str | None] = mapped_column(String(50))
    locator_code: Mapped[str | None] = mapped_column(String(20))
    loyalty_card_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("loyalty_cards.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
