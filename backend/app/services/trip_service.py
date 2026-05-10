import logging
from datetime import date
from decimal import Decimal
from pathlib import Path
from uuid import UUID, uuid4

import aiofiles
import aiofiles.os
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.models.trip import Trip
from app.models.trip_leg import TripLeg
from app.models.user import User
from app.schemas.trip import TripCreate, TripSummary, TripUpdate
from app.services import currency_service, unsplash_service

logger = logging.getLogger(__name__)

_COVERS_DIR = Path("/app/uploads/covers")


async def list_trips(
    db: AsyncSession, user_id: UUID, status_filter: str | None = None
) -> list[Trip]:
    q = select(Trip).where(Trip.user_id == user_id)
    if status_filter:
        q = q.where(Trip.status == status_filter)
    result = await db.execute(q.order_by(Trip.start_date.desc()))
    return list(result.scalars().all())


async def create(db: AsyncSession, user_id: UUID, data: TripCreate) -> Trip:
    if data.id is not None:
        existing = await db.get(Trip, data.id)
        if existing and existing.user_id == user_id:
            return existing

    trip = Trip(
        id=data.id or uuid4(),
        user_id=user_id,
        **data.model_dump(exclude={"id"}),
    )
    db.add(trip)
    await db.flush()
    await db.commit()
    await db.refresh(trip)

    try:
        img_bytes = await unsplash_service.fetch_cover(data.destination)
        if img_bytes:
            await aiofiles.os.makedirs(_COVERS_DIR, exist_ok=True)
            cover_path = _COVERS_DIR / f"{trip.id}.jpg"
            async with aiofiles.open(cover_path, "wb") as f:
                await f.write(img_bytes)
            trip.cover_image_path = f"covers/{trip.id}.jpg"
            await db.flush()
            await db.commit()
            await db.refresh(trip)
    except Exception as exc:
        logger.warning("trip_service.create: portada automática falló para %s: %s", trip.id, exc)

    return trip


async def get_or_404(db: AsyncSession, trip_id: UUID, user_id: UUID) -> Trip:
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.user_id == user_id)
    )
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Trip {trip_id} not found")
    return trip


async def update(
    db: AsyncSession, trip_id: UUID, user_id: UUID, data: TripUpdate
) -> Trip:
    trip = await get_or_404(db, trip_id, user_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(trip, field, value)
    await db.flush()
    await db.refresh(trip)
    return trip


async def delete(db: AsyncSession, trip_id: UUID, user_id: UUID) -> None:
    trip = await get_or_404(db, trip_id, user_id)
    await db.delete(trip)


async def get_summary(db: AsyncSession, trip_id: UUID, user: User) -> TripSummary:
    trip = await get_or_404(db, trip_id, user.id)

    # Total gastado (ya está en currency_base del usuario)
    spent_result = await db.execute(
        select(func.sum(Expense.amount_base)).where(Expense.trip_id == trip_id)
    )
    spent_base: Decimal = spent_result.scalar() or Decimal("0")

    # Convertir presupuesto a currency_base si difiere
    if trip.budget_currency == user.currency_base:
        budget_base = trip.budget
    else:
        budget_base, _ = await currency_service.convert(
            db, trip.budget, trip.budget_currency, user.currency_base, date.today()
        )

    # Conteos
    expense_count_result = await db.execute(
        select(func.count(Expense.id)).where(Expense.trip_id == trip_id)
    )
    legs_count_result = await db.execute(
        select(func.count(TripLeg.id)).where(TripLeg.trip_id == trip_id)
    )

    percentage = float(spent_base / budget_base * 100) if budget_base > 0 else 0.0

    return TripSummary(
        trip_id=trip_id,
        name=trip.name,
        spent_base=spent_base,
        budget_base=budget_base,
        currency_base=user.currency_base,
        percentage=round(percentage, 1),
        expense_count=expense_count_result.scalar() or 0,
        legs_count=legs_count_result.scalar() or 0,
    )
