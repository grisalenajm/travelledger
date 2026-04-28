from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.trip_leg import TripLegCreate, TripLegRead, TripLegUpdate
from app.services import leg_service

router = APIRouter(prefix="/api/trips/{trip_id}/legs", tags=["legs"], redirect_slashes=False)


@router.get("", response_model=list[TripLegRead])
async def list_legs(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await leg_service.list_legs(db, trip_id, user.id)


@router.post("", response_model=TripLegRead, status_code=status.HTTP_201_CREATED)
async def create_leg(
    trip_id: UUID,
    data: TripLegCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await leg_service.create(db, trip_id, user.id, data)


@router.put("/{leg_id}", response_model=TripLegRead)
async def update_leg(
    trip_id: UUID,
    leg_id: UUID,
    data: TripLegUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await leg_service.update(db, trip_id, leg_id, user.id, data)


@router.delete("/{leg_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_leg(
    trip_id: UUID,
    leg_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await leg_service.delete(db, trip_id, leg_id, user.id)
