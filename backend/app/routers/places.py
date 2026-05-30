from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.geocoding_service import search_hotels, search_places
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/places", tags=["places"])


@router.get("/hotels")
async def search_hotels_endpoint(
    q: str = Query(..., min_length=2, max_length=100),
    _user: User = Depends(get_current_user),
) -> list[dict]:
    results = await search_hotels(q)
    return results


@router.get("/search")
async def search_places_endpoint(
    q: str = Query(..., min_length=2, max_length=100),
    type: str = Query(default="city"),
    _user: User = Depends(get_current_user),
) -> list[dict]:
    """Búsqueda genérica de lugares via Nominatim.

    type="city"     → ciudades, pueblos, aldeas
    type="business" → negocios, puntos de interés
    """
    results = await search_places(q, type)
    return results
