import asyncio
import logging
import time

import httpx

logger = logging.getLogger(__name__)

_cache: dict[str, tuple[float, float] | None] = {}
_hotel_cache: dict[str, list[dict]] = {}
_places_cache: dict[str, list[dict]] = {}
_lock = asyncio.Lock()
_last_request_time: float = 0.0

_RATE_LIMIT_SECONDS = 1.0
_USER_AGENT = "Ledger/2.0 (homelab; self-hosted travel expenses app)"


async def geocode(address: str) -> tuple[float, float] | None:
    """Return (lat, lng) for address using Nominatim, or None if not found.

    Caches results in-memory and rate-limits to 1 req/s per Nominatim ToS.
    """
    if address in _cache:
        return _cache[address]

    async with _lock:
        # Re-check after acquiring lock (another coroutine may have filled it)
        if address in _cache:
            return _cache[address]

        global _last_request_time
        elapsed = time.monotonic() - _last_request_time
        if elapsed < 1.0:
            await asyncio.sleep(1.0 - elapsed)

        try:
            async with httpx.AsyncClient(
                headers={"User-Agent": _USER_AGENT},
                timeout=10.0,
            ) as client:
                r = await client.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={"q": address, "format": "json", "limit": 1},
                )
                _last_request_time = time.monotonic()
                r.raise_for_status()
                results = r.json()
                if results:
                    coords: tuple[float, float] = (float(results[0]["lat"]), float(results[0]["lon"]))
                    _cache[address] = coords
                    return coords
                _cache[address] = None
                return None
        except Exception as exc:
            logger.warning("geocoding_service: geocode '%s' failed: %s", address, exc)
            _last_request_time = time.monotonic()
            return None


async def search_hotels(query: str) -> list[dict]:
    """Busca hoteles/alojamientos via Nominatim con caché en memoria.

    Comparte el rate-limit (1 req/s) con geocode() para cumplir los ToS de Nominatim.
    """
    if query in _hotel_cache:
        return _hotel_cache[query]

    async with _lock:
        if query in _hotel_cache:
            return _hotel_cache[query]

        global _last_request_time
        elapsed = time.monotonic() - _last_request_time
        if elapsed < _RATE_LIMIT_SECONDS:
            await asyncio.sleep(_RATE_LIMIT_SECONDS - elapsed)

        try:
            async with httpx.AsyncClient(
                headers={"User-Agent": _USER_AGENT},
                timeout=5.0,
            ) as client:
                r = await client.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={
                        "q": query,
                        "format": "json",
                        "limit": 5,
                        "addressdetails": 1,
                    },
                )
                _last_request_time = time.monotonic()
                r.raise_for_status()
                data = r.json()
                results = [
                    {
                        "name": item.get("display_name", "").split(",")[0].strip(),
                        "address": item.get("display_name", ""),
                        "lat": float(item["lat"]),
                        "lng": float(item["lon"]),
                    }
                    for item in data
                    if item.get("display_name")
                ]
                _hotel_cache[query] = results
                return results
        except Exception as exc:
            logger.warning("geocoding_service: hotel search '%s' failed: %s", query, exc)
            _last_request_time = time.monotonic()
            return []


async def search_places(query: str, place_type: str = "city") -> list[dict]:
    """Busca lugares (ciudades o negocios) via Nominatim con caché en memoria.

    place_type: "city" → ciudades/pueblos, "business" → negocios/puntos de interés.
    Comparte el rate-limit (1 req/s) con geocode() y search_hotels() para cumplir
    los ToS de Nominatim.
    """
    cache_key = f"{place_type}:{query}"
    if cache_key in _places_cache:
        return _places_cache[cache_key]

    async with _lock:
        if cache_key in _places_cache:
            return _places_cache[cache_key]

        global _last_request_time
        elapsed = time.monotonic() - _last_request_time
        if elapsed < _RATE_LIMIT_SECONDS:
            await asyncio.sleep(_RATE_LIMIT_SECONDS - elapsed)

        params: dict = {
            "q": query,
            "format": "json",
            "limit": 5,
            "addressdetails": 1,
        }
        if place_type == "business":
            params["featuretype"] = "settlement,poi"
        else:
            params["featuretype"] = "city,town,village,hamlet"

        try:
            async with httpx.AsyncClient(
                headers={"User-Agent": _USER_AGENT},
                timeout=5.0,
            ) as client:
                r = await client.get(
                    "https://nominatim.openstreetmap.org/search",
                    params=params,
                )
                _last_request_time = time.monotonic()
                r.raise_for_status()
                data = r.json()
                results = [
                    {
                        "name": item.get("display_name", "").split(",")[0].strip(),
                        "display": item.get("display_name", ""),
                        "lat": float(item["lat"]),
                        "lng": float(item["lon"]),
                    }
                    for item in data
                    if item.get("display_name")
                ]
                _places_cache[cache_key] = results
                return results
        except Exception as exc:
            logger.warning("geocoding_service: place search '%s' (%s) failed: %s", query, place_type, exc)
            _last_request_time = time.monotonic()
            return []
