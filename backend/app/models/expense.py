from datetime import date as date_t, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    trip_id: Mapped[UUID] = mapped_column(
        ForeignKey("trips.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    amount_base: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    rate_date: Mapped[date_t] = mapped_column(nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    # valores: Dining | Lodging | Transport | Culture | Shopping | Health | Other
    description: Mapped[str | None] = mapped_column(Text)
    date: Mapped[date_t] = mapped_column(nullable=False)
    payment_method: Mapped[str | None] = mapped_column(String(20))
    # valores: card | cash | transfer | other
    billable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # CRÍTICO: default True — todo gasto es facturable por defecto
    loyalty_card_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("loyalty_cards.id", ondelete="SET NULL"), nullable=True
    )
    paperless_doc_id: Mapped[int | None] = mapped_column(nullable=True)
    # Se rellena en Fase 3 (OCR). En Flujo A siempre None.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
