import hashlib
import hmac
import json
import logging
import time
from typing import Any

import httpx

from config import settings

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0)


def _signed_headers(body: bytes) -> dict[str, str]:
    """Genera headers con firma HMAC-SHA256 para cada request."""
    ts = str(int(time.time()))
    msg = f"{ts}.".encode() + body
    sig = hmac.new(settings.BOT_API_KEY.encode(), msg, hashlib.sha256).hexdigest()
    return {
        "X-Bot-Api-Key": settings.BOT_API_KEY,
        "X-Timestamp": ts,
        "X-Signature": sig,
    }


async def get(path: str) -> Any:
    async with httpx.AsyncClient(
        base_url=settings.LEDGER_API_URL,
        headers=_signed_headers(b""),
        timeout=_TIMEOUT,
        verify=True,
    ) as client:
        r = await client.get(path)
        r.raise_for_status()
        return r.json()


async def post(path: str, data: dict | None = None, files: dict | None = None) -> Any:
    if files:
        # Multipart: body no determinista antes de la serialización — firmamos body vacío
        async with httpx.AsyncClient(
            base_url=settings.LEDGER_API_URL,
            headers=_signed_headers(b""),
            timeout=_TIMEOUT,
            verify=True,
        ) as client:
            r = await client.post(path, data=data or {}, files=files)
            r.raise_for_status()
            return r.json()
    else:
        body = json.dumps(data or {}, separators=(",", ":")).encode()
        async with httpx.AsyncClient(
            base_url=settings.LEDGER_API_URL,
            headers={**_signed_headers(body), "Content-Type": "application/json"},
            timeout=_TIMEOUT,
            verify=True,
        ) as client:
            r = await client.post(path, content=body)
            r.raise_for_status()
            return r.json()
