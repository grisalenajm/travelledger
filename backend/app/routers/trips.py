import logging
from datetime import date as date_type
from pathlib import Path
from uuid import UUID

import aiofiles
import aiofiles.os
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_effective_user_id, require_not_guest
from app.database import get_db
from app.models.user import User
from app.schemas.map import TripMapData
from app.schemas.stats import TripStats
from app.schemas.trip import TripCreate, TripRead, TripSummary, TripUpdate
from app.services import map_service, paperless_service, stats_service, trip_service

logger = logging.getLogger(__name__)
_COVERS_DIR = Path("/app/uploads/covers")

router = APIRouter(prefix="/api/trips", tags=["trips"], redirect_slashes=False)


@router.get("", response_model=list[TripRead])
async def list_trips(
    trip_status: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    effective_id: UUID = Depends(get_effective_user_id),
):
    return await trip_service.list_trips(db, effective_id, trip_status)


@router.post("", response_model=TripRead, status_code=status.HTTP_201_CREATED)
async def create_trip(
    data: TripCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_not_guest),
):
    return await trip_service.create(db, user.id, data)


@router.get("/active", response_model=TripRead | None)
async def get_active_trip(
    db: AsyncSession = Depends(get_db),
    effective_id: UUID = Depends(get_effective_user_id),
):
    """Devuelve el viaje activo de hoy (start_date ≤ hoy ≤ end_date, status=active).
    Si hay varios, el más reciente. Devuelve null si no hay ninguno."""
    return await trip_service.get_active_trip(db, effective_id)


@router.get("/{trip_id}", response_model=TripRead)
async def get_trip(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    effective_id: UUID = Depends(get_effective_user_id),
):
    return await trip_service.get_or_404(db, trip_id, effective_id)


@router.put("/{trip_id}", response_model=TripRead)
async def update_trip(
    trip_id: UUID,
    data: TripUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_not_guest),
):
    return await trip_service.update(db, trip_id, user.id, data)


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_not_guest),
):
    await trip_service.delete(db, trip_id, user.id)


@router.get("/{trip_id}/map-data", response_model=TripMapData)
async def get_map_data(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    effective_id: UUID = Depends(get_effective_user_id),
):
    return await map_service.get_map_data(db, trip_id, effective_id)


@router.get("/{trip_id}/stats", response_model=TripStats)
async def get_trip_stats(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    effective_id: UUID = Depends(get_effective_user_id),
):
    return await stats_service.get_trip_stats(db, trip_id, user, effective_user_id=effective_id)


@router.get("/{trip_id}/summary", response_model=TripSummary)
async def get_summary(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    effective_id: UUID = Depends(get_effective_user_id),
):
    return await trip_service.get_summary(db, trip_id, user, effective_user_id=effective_id)


_ALLOWED_IMAGE_MAGIC: list[tuple[bytes, str]] = [
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG", "image/png"),
]


def _detect_mime(content: bytes) -> str:
    for magic, mime in _ALLOWED_IMAGE_MAGIC:
        if content[: len(magic)] == magic:
            return mime
    # WebP: RIFF????WEBP
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    raise HTTPException(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "Unsupported image format. Use JPEG, PNG, or WebP.",
    )


@router.post("/{trip_id}/cover", response_model=TripRead)
async def upload_cover(
    trip_id: UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_not_guest),
):
    trip = await trip_service.get_or_404(db, trip_id, user.id)
    content = await file.read()
    mime = _detect_mime(content)

    await aiofiles.os.makedirs(_COVERS_DIR, exist_ok=True)
    cover_path = _COVERS_DIR / f"{trip_id}.jpg"
    async with aiofiles.open(cover_path, "wb") as f:
        await f.write(content)

    trip.cover_image_path = f"covers/{trip_id}.jpg"
    try:
        filename = file.filename or f"cover_{trip_id}.jpg"
        doc_id = await paperless_service.upload_document(
            content, filename, mime, db, user.id,
            title_parts={"category": "cover", "date": str(date_type.today()), "trip_name": trip.name},
        )
        trip.cover_doc_id = doc_id
    except Exception as exc:
        logger.warning("upload_cover: Paperless upload failed for %s: %s", trip_id, exc)

    await db.flush()
    await db.refresh(trip)
    return trip


@router.get("/{trip_id}/cover")
async def get_cover(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    effective_id: UUID = Depends(get_effective_user_id),
):
    trip = await trip_service.get_or_404(db, trip_id, effective_id)
    if not trip.cover_image_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No cover image")
    cover_path = Path("/app/uploads") / trip.cover_image_path
    if not await aiofiles.os.path.exists(cover_path):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cover image not found")
    return FileResponse(cover_path, media_type="image/jpeg")


@router.get("/{trip_id}/cover-url")
async def get_cover_url(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    effective_id: UUID = Depends(get_effective_user_id),
):
    trip = await trip_service.get_or_404(db, trip_id, effective_id)
    if not trip.cover_doc_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No cover image")
    url = await paperless_service.get_url(trip.cover_doc_id, db, effective_id)
    return {"url": url}
