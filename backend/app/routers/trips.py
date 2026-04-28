from datetime import date as date_type
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.trip import TripCreate, TripRead, TripSummary, TripUpdate
from app.services import paperless_service, trip_service

router = APIRouter(prefix="/api/trips", tags=["trips"], redirect_slashes=False)


@router.get("", response_model=list[TripRead])
async def list_trips(
    trip_status: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await trip_service.list_trips(db, user.id, trip_status)


@router.post("", response_model=TripRead, status_code=status.HTTP_201_CREATED)
async def create_trip(
    data: TripCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await trip_service.create(db, user.id, data)


@router.get("/{trip_id}", response_model=TripRead)
async def get_trip(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await trip_service.get_or_404(db, trip_id, user.id)


@router.put("/{trip_id}", response_model=TripRead)
async def update_trip(
    trip_id: UUID,
    data: TripUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await trip_service.update(db, trip_id, user.id, data)


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await trip_service.delete(db, trip_id, user.id)


@router.get("/{trip_id}/summary", response_model=TripSummary)
async def get_summary(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await trip_service.get_summary(db, trip_id, user)


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
    user: User = Depends(get_current_user),
):
    trip = await trip_service.get_or_404(db, trip_id, user.id)
    content = await file.read()
    mime = _detect_mime(content)
    filename = file.filename or f"cover_{trip_id}.jpg"
    doc_id = await paperless_service.upload_document(
        content, filename, mime, db, user.id,
        title_parts={"category": "cover", "date": str(date_type.today()), "trip_name": trip.name},
    )
    trip.cover_doc_id = doc_id
    await db.flush()
    await db.refresh(trip)
    return trip


@router.get("/{trip_id}/cover-url")
async def get_cover_url(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    trip = await trip_service.get_or_404(db, trip_id, user.id)
    if not trip.cover_doc_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No cover image")
    url = await paperless_service.get_url(trip.cover_doc_id, db, user.id)
    return {"url": url}
