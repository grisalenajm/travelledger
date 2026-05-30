from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TripLeg(Base):
    __tablename__ = "trip_legs"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    trip_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("trips.id", ondelete="CASCADE"), nullable=True
    )
    user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    # flight | accommodation | car_rental | train | bus | ferry | other
    mode: Mapped[str] = mapped_column(String(20), nullable=False)

    # ── Comunes ──────────────────────────────────────────────────────────────
    notes: Mapped[str | None] = mapped_column(Text)
    document_path: Mapped[str | None] = mapped_column(Text)
    expense_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("expenses.id", ondelete="SET NULL"), nullable=True
    )

    # ── Transporte (flight|train|bus|ferry|other) ─────────────────────────────
    origin: Mapped[str | None] = mapped_column(String(100))
    destination: Mapped[str | None] = mapped_column(String(100))
    origin_lat: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    origin_lng: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    destination_lat: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    destination_lng: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    departure_local: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    arrival_local: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    carrier: Mapped[str | None] = mapped_column(String(100))
    flight_number: Mapped[str | None] = mapped_column(String(20))
    reservation_number: Mapped[str | None] = mapped_column(String(50))
    locator_code: Mapped[str | None] = mapped_column(String(20))
    seat: Mapped[str | None] = mapped_column(String(10))
    distance_km: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    loyalty_card_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("loyalty_cards.id", ondelete="SET NULL"), nullable=True
    )

    # ── Alojamiento ───────────────────────────────────────────────────────────
    accommodation_name: Mapped[str | None] = mapped_column(String(200))
    accommodation_address: Mapped[str | None] = mapped_column(Text)
    accommodation_lat: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    accommodation_lng: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    accommodation_provider: Mapped[str | None] = mapped_column(String(100))
    check_in: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    check_out: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))

    # ── Alquiler de coche ─────────────────────────────────────────────────────
    rental_company: Mapped[str | None] = mapped_column(String(100))
    pickup_location: Mapped[str | None] = mapped_column(String(200))
    pickup_lat: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    pickup_lng: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    dropoff_location: Mapped[str | None] = mapped_column(String(200))
    dropoff_lat: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    dropoff_lng: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    pickup_datetime: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    dropoff_datetime: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    confirmation_number: Mapped[str | None] = mapped_column(String(50))

    # ── Importación automática ────────────────────────────────────────────────
    source: Mapped[str | None] = mapped_column(String(50))
    confirmed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
