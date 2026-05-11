import ipaddress
import logging
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.services import settings_service
from app.services.settings_service import migrate_to_paperless

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/settings", tags=["settings"], redirect_slashes=False)

_KNOWN_KEYS = {
    "paperless_url", "paperless_token", "paperless_enabled",
    "anthropic_api_key", "language", "theme",
}
_TOKEN_PLACEHOLDER = "***"

_BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "ip6-localhost"}
_BLOCKED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fe80::/10"),
]


def _validate_paperless_url(url: str) -> str:
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
        pass
    else:
        for net in _BLOCKED_NETWORKS:
            if ip in net:
                raise ValueError(f"Rango de IP no permitido: {net}")
    return url.rstrip("/")


class SettingUpsert(BaseModel):
    key: str
    value: str | None = None


class SettingsRead(BaseModel):
    paperless_url: str | None = None
    paperless_enabled: bool = False
    paperless_token_set: bool = False
    anthropic_api_key_set: bool = False
    language: str | None = None
    theme: str | None = None


class PaperlessVerifyResult(BaseModel):
    ok: bool
    error: str | None = None


class MigrateNowResult(BaseModel):
    migrated: int
    failed: int
    errors: list[str]


@router.get("", response_model=SettingsRead)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await settings_service.get_all(db, current_user.id)
    return SettingsRead(
        paperless_url=data.get("paperless_url"),
        paperless_enabled=data.get("paperless_enabled") == "true",
        paperless_token_set=bool(data.get("paperless_token")),
        anthropic_api_key_set=bool(data.get("anthropic_api_key")),
        language=data.get("language"),
        theme=data.get("theme"),
    )


@router.put("", status_code=status.HTTP_204_NO_CONTENT)
async def upsert_setting(
    payload: SettingUpsert,
    background_tasks: BackgroundTasks,
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

    if payload.key in ("paperless_url", "paperless_token"):
        background_tasks.add_task(migrate_to_paperless, db, current_user.id)


@router.post("/migrate-now", response_model=MigrateNowResult)
async def migrate_now(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await migrate_to_paperless(db, current_user.id)
    return MigrateNowResult(**result)


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
        _validate_paperless_url(url)
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
