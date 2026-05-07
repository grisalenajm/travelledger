import ipaddress
import logging
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.services import settings_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/settings", tags=["settings"], redirect_slashes=False)

_KNOWN_KEYS = {"paperless_url", "paperless_token"}
_TOKEN_PLACEHOLDER = "***"

_BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "ip6-localhost"}
_BLOCKED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),  # link-local / cloud metadata endpoints
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fe80::/10"),
]


def _validate_paperless_url(url: str) -> str:
    """Raises ValueError if url is not a safe http/https URL."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("URL debe usar esquema http o https")
    host = parsed.hostname
    if not host:
        raise ValueError("URL sin host")
    if host.lower() in _BLOCKED_HOSTS:
        raise ValueError("Host no permitido")
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        pass  # hostname, not an IP — allow
    else:
        for net in _BLOCKED_NETWORKS:
            if ip in net:
                raise ValueError(f"Rango de IP no permitido: {net}")
    return url.rstrip("/")


class SettingUpsert(BaseModel):
    key: str
    value: str | None = None


class PaperlessVerifyResult(BaseModel):
    ok: bool
    error: str | None = None


@router.get("", response_model=dict[str, str | None])
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await settings_service.get_all(db, current_user.id)
    return {
        "paperless_url": data.get("paperless_url"),
        "paperless_token": _TOKEN_PLACEHOLDER if data.get("paperless_token") else None,
    }


@router.put("", status_code=status.HTTP_204_NO_CONTENT)
async def upsert_setting(
    payload: SettingUpsert,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.key not in _KNOWN_KEYS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown setting key: {payload.key}")

    if payload.key == "paperless_token" and payload.value == _TOKEN_PLACEHOLDER:
        return  # client echoed the masked placeholder — skip update

    if payload.key == "paperless_url" and payload.value:
        try:
            payload.value = _validate_paperless_url(payload.value)
        except ValueError as exc:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, f"URL de Paperless no válida: {exc}"
            )

    await settings_service.set(db, current_user.id, payload.key, payload.value)


@router.post("/verify-paperless", response_model=PaperlessVerifyResult)
async def verify_paperless(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    url = await settings_service.get(db, current_user.id, "paperless_url")
    token = await settings_service.get(db, current_user.id, "paperless_token")

    if not url or not token:
        return PaperlessVerifyResult(
            ok=False, error="paperless_url or paperless_token not configured"
        )

    try:
        _validate_paperless_url(url)  # defense-in-depth: validate even stored values
    except ValueError as exc:
        return PaperlessVerifyResult(ok=False, error=f"URL inválida: {exc}")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{url.rstrip('/')}/api/documents/",
                params={"page_size": 1},
                headers={"Authorization": f"Token {token}"},
            )
        if resp.status_code == 200:
            return PaperlessVerifyResult(ok=True)
        return PaperlessVerifyResult(ok=False, error=f"HTTP {resp.status_code}")
    except httpx.RequestError as exc:
        logger.warning("verify_paperless failed error=%s", exc)
        return PaperlessVerifyResult(ok=False, error=str(exc))
