from fastapi import APIRouter, HTTPException, Query

from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.geocoding_service import search, reverse_geocode
from fastapi import Depends

router = APIRouter(prefix="/api/geocoding", tags=["geocoding"])


@router.get("/search")
async def search_locations(
    q: str = Query(..., min_length=3),
    limit: int = Query(5, ge=1, le=10),
    _user: User = Depends(get_current_user),
) -> list[dict]:
    """Busca ubicaciones por texto libre (Nominatim). Devuelve name + display_name separados."""
    results = await search(q, limit)
    return [
        {
            "place_id": r.get("place_id"),
            "name": (
                r.get("name")
                or r.get("display_name", "").split(",")[0].strip()
            ),
            "display_name": r.get("display_name", ""),
            "lat": float(r.get("lat", 0)),
            "lon": float(r.get("lon", 0)),
            "type": r.get("type"),
            "address": r.get("address", {}),
        }
        for r in results
    ]


@router.get("/reverse")
async def reverse_geocode_endpoint(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    _user: User = Depends(get_current_user),
) -> dict:
    """Convierte coordenadas a nombre de lugar. Usado tras arrastrar un marker en el mapa."""
    result = await reverse_geocode(lat, lng)
    if not result:
        raise HTTPException(status_code=404, detail="No se encontró ubicación")
    return {
        "name": (
            result.get("name")
            or result.get("display_name", "").split(",")[0].strip()
        ),
        "display_name": result.get("display_name", ""),
        "lat": float(result.get("lat", lat)),
        "lon": float(result.get("lon", lng)),
        "address": result.get("address", {}),
    }
