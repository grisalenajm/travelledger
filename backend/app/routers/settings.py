import logging

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
    return {key: data.get(key) for key in _KNOWN_KEYS}


@router.put("", status_code=status.HTTP_204_NO_CONTENT)
async def upsert_setting(
    payload: SettingUpsert,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.key not in _KNOWN_KEYS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown setting key: {payload.key}")
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
        logger.warning("verify_paperless failed url=%s error=%s", url, exc)
        return PaperlessVerifyResult(ok=False, error=str(exc))
