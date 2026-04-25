from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.trip import TripCreate, TripRead, TripSummary, TripUpdate
from app.services import trip_service

router = APIRouter(prefix="/api/trips", tags=["trips"])


@router.get("/", response_model=list[TripRead])
async def list_trips(
    trip_status: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await trip_service.list_trips(db, user.id, trip_status)


@router.post("/", response_model=TripRead, status_code=status.HTTP_201_CREATED)
async def create_trip(
    data: TripCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await trip_service.create(db, user.id, data)


@router.get("/{trip_id}", response_model=TripRead)
async def get_trip(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await trip_service.get_or_404(db, trip_id, user.id)


@router.put("/{trip_id}", response_model=TripRead)
async def update_trip(
    trip_id: UUID,
    data: TripUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await trip_service.update(db, trip_id, user.id, data)


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await trip_service.delete(db, trip_id, user.id)


@router.get("/{trip_id}/summary", response_model=TripSummary)
async def get_summary(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await trip_service.get_summary(db, trip_id, user)
