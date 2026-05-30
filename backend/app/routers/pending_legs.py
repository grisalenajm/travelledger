"""Endpoints para tramos pendientes de asignación a un viaje."""
import logging
from uuid import UUID


from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_effective_user_id, require_not_guest
from app.database import get_db
from app.models.trip import Trip
from app.models.trip_leg import TripLeg
from app.models.user import User
from app.schemas.trip_leg import TripLegRead, TripLegUpdate
from app.services import leg_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/legs", tags=["pending-legs"], redirect_slashes=False)


class AssignTripPayload(BaseModel):
    trip_id: UUID


@router.get("/pending", response_model=list[TripLegRead])
async def list_pending_legs(
    db: AsyncSession = Depends(get_db),
    effective_id: UUID = Depends(get_effective_user_id),
) -> list[TripLeg]:
    """Devuelve los tramos importados pendientes de asignación a un viaje."""
    result = await db.execute(
        select(TripLeg)
        .where(
            TripLeg.user_id == effective_id,
            TripLeg.trip_id.is_(None),
        )
        .order_by(TripLeg.created_at.desc())
    )
    return list(result.scalars().all())


@router.put("/{leg_id}/assign", response_model=TripLegRead)
async def assign_leg_to_trip(
    leg_id: UUID,
    payload: AssignTripPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_not_guest),
) -> TripLeg:
    """Asigna un tramo pendiente a un viaje del usuario."""
    # Verificar que el leg existe y pertenece al usuario
    leg_result = await db.execute(
        select(TripLeg).where(
            TripLeg.id == leg_id,
            TripLeg.user_id == current_user.id,
            TripLeg.trip_id.is_(None),
        )
    )
    leg = leg_result.scalar_one_or_none()
    if not leg:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tramo pendiente no encontrado")

    # Verificar que el viaje existe y pertenece al usuario
    trip_result = await db.execute(
        select(Trip).where(
            Trip.id == payload.trip_id,
            Trip.user_id == current_user.id,
        )
    )
    trip = trip_result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Viaje no encontrado")

    leg.trip_id = payload.trip_id
    leg.confirmed = True
    await db.commit()
    await db.refresh(leg)
    logger.info("assign_leg: leg=%s → trip=%s", leg_id, payload.trip_id)
    return leg


@router.put("/{leg_id}", response_model=TripLegRead)
async def update_pending_leg(
    leg_id: UUID,
    data: TripLegUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_not_guest),
) -> TripLeg:
    """Actualiza campos de un tramo pendiente (sin trip_id)."""
    leg = await leg_service.update_pending(db, leg_id, current_user.id, data)
    if not leg:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tramo pendiente no encontrado")
    return leg


@router.delete("/{leg_id}", status_code=status.HTTP_204_NO_CONTENT)
async def discard_pending_leg(
    leg_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_not_guest),
) -> None:
    """Descarta un tramo pendiente sin asignarlo a ningún viaje."""
    await leg_service.discard_pending(db, leg_id, current_user.id)
