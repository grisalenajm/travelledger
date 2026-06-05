import logging
from pathlib import Path
from uuid import UUID

import aiofiles
import aiofiles.os
import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_COVERS_DIR = Path("/app/uploads/covers")


async def fetch_cover(destination: str) -> bytes | None:
    if not settings.UNSPLASH_ACCESS_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            search = await client.get(
                "https://api.unsplash.com/search/photos",
                params={"query": destination, "per_page": 1, "orientation": "landscape"},
                headers={"Authorization": f"Client-ID {settings.UNSPLASH_ACCESS_KEY}"},
            )
            search.raise_for_status()
            results = search.json().get("results", [])
            if not results:
                return None
            img_url = results[0]["urls"]["regular"]
            img = await client.get(img_url, timeout=20.0)
            img.raise_for_status()
            return img.content
    except Exception as exc:
        logger.warning("unsplash_service.fetch_cover(%s) failed: %s", destination, exc)
        return None


async def fetch_and_save_cover(trip_id: UUID, destination: str) -> bool:
    """Descarga una imagen de Unsplash y la guarda como portada del viaje.

    Diseñado para ejecutarse como background task.
    Devuelve True si tuvo éxito, False si falló o no había key.
    """
    from app.database import AsyncSessionLocal
    from app.models.trip import Trip

    img_bytes = await fetch_cover(destination)
    if not img_bytes:
        return False

    try:
        await aiofiles.os.makedirs(_COVERS_DIR, exist_ok=True)
        cover_path = _COVERS_DIR / f"{trip_id}.jpg"
        async with aiofiles.open(cover_path, "wb") as f:
            await f.write(img_bytes)

        async with AsyncSessionLocal() as db:
            trip = await db.get(Trip, trip_id)
            if trip:
                trip.cover_image_path = f"covers/{trip_id}.jpg"
                await db.commit()
        return True
    except Exception as exc:
        logger.warning(
            "unsplash_service.fetch_and_save_cover(%s, %s) failed: %s",
            trip_id, destination, exc,
        )
        return False
