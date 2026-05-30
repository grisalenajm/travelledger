from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.airport_service import airport_service

router = APIRouter(prefix="/api/airports", tags=["airports"])


@router.get("/search")
async def search_airports(
    q: str = Query("", min_length=0),
    _user: User = Depends(get_current_user),
) -> list[dict]:
    results = airport_service.search(q)
    return [
        {"iata": a.iata, "name": a.name, "city": a.city, "country": a.country, "lat": a.lat, "lng": a.lng}
        for a in results
    ]
