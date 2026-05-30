from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.airline import AirlineRead
from app.services.airline_service import airline_service

router = APIRouter(prefix="/api/airlines", tags=["airlines"])


@router.get("/search")
async def search_airlines(
    q: str = Query(..., min_length=1, max_length=50),
    _user: User = Depends(get_current_user),
) -> list[AirlineRead]:
    results = airline_service.search(q)
    return [
        AirlineRead(
            iata=a.iata,
            name=a.name,
            country=a.country,
            logo_url=a.logo_url,
        )
        for a in results
    ]
