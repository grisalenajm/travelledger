import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


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
