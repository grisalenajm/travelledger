import logging

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_effective_user_id
from app.database import get_db
from app.models.user import User
from app.schemas.stats import FlightStats, GlobalStats
from app.services import stats_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stats", tags=["stats"], redirect_slashes=False)


@router.get("/global", response_model=GlobalStats)
async def get_global_stats(
    period: str = Query(default="year"),
    year: int = Query(default=2026),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    effective_id: UUID = Depends(get_effective_user_id),
):
    return await stats_service.get_global_stats(db, user, period, year, effective_user_id=effective_id)


@router.get("/flights", response_model=FlightStats)
async def get_flight_stats(
    period: str = Query(default="year"),
    year: int = Query(default=2026),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    effective_id: UUID = Depends(get_effective_user_id),
):
    return await stats_service.get_flight_stats(db, user, period, year, effective_user_id=effective_id)
