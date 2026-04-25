from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trip_leg import TripLeg
from app.schemas.trip_leg import TripLegCreate, TripLegUpdate
from app.services.trip_service import get_or_404 as get_trip_or_404


async def list_legs(db: AsyncSession, trip_id: UUID, user_id: UUID) -> list[TripLeg]:
    await get_trip_or_404(db, trip_id, user_id)  # verifica ownership del trip
    result = await db.execute(
        select(TripLeg)
        .where(TripLeg.trip_id == trip_id)
        .order_by(TripLeg.departure_local)
    )
    return list(result.scalars().all())


async def create(
    db: AsyncSession, trip_id: UUID, user_id: UUID, data: TripLegCreate
) -> TripLeg:
    await get_trip_or_404(db, trip_id, user_id)
    leg = TripLeg(trip_id=trip_id, **data.model_dump())
    db.add(leg)
    await db.flush()
    await db.refresh(leg)
    return leg


async def update(
    db: AsyncSession, trip_id: UUID, leg_id: UUID, user_id: UUID, data: TripLegUpdate
) -> TripLeg:
    leg = await _get_leg_or_404(db, trip_id, leg_id, user_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(leg, field, value)
    await db.flush()
    await db.refresh(leg)
    return leg


async def delete(
    db: AsyncSession, trip_id: UUID, leg_id: UUID, user_id: UUID
) -> None:
    leg = await _get_leg_or_404(db, trip_id, leg_id, user_id)
    await db.delete(leg)


async def _get_leg_or_404(
    db: AsyncSession, trip_id: UUID, leg_id: UUID, user_id: UUID
) -> TripLeg:
    await get_trip_or_404(db, trip_id, user_id)
    result = await db.execute(
        select(TripLeg).where(TripLeg.id == leg_id, TripLeg.trip_id == trip_id)
    )
    leg = result.scalar_one_or_none()
    if not leg:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"TripLeg {leg_id} not found")
    return leg
