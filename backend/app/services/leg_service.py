import logging
import math
from decimal import Decimal
from pathlib import Path
from uuid import UUID

import aiofiles
import aiofiles.os
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trip_leg import TripLeg
from app.schemas.trip_leg import TripLegCreate, TripLegUpdate
from app.services import geocoding_service
from app.services.airport_service import airport_service
from app.services.trip_service import get_or_404 as get_trip_or_404

logger = logging.getLogger(__name__)

_LEGS_DIR = Path("/app/uploads/legs")


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> Decimal:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return Decimal(str(round(R * 2 * math.asin(math.sqrt(a)), 2)))


def _maybe_compute_distance(leg: TripLeg) -> Decimal | None:
    if leg.mode != "flight":
        return None
    coords = [leg.origin_lat, leg.origin_lng, leg.destination_lat, leg.destination_lng]
    if any(c is None for c in coords):
        return None
    return _haversine_km(
        float(leg.origin_lat), float(leg.origin_lng),  # type: ignore[arg-type]
        float(leg.destination_lat), float(leg.destination_lng),  # type: ignore[arg-type]
    )


def _validate_and_get_ext(content: bytes, filename: str | None) -> str:
    h = content[:12]
    if h[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if h[:4] == b"\x89PNG":
        return ".png"
    if h[:4] == b"%PDF":
        return ".pdf"
    if h[:4] == b"RIFF" and h[8:12] == b"WEBP":
        return ".webp"
    raise HTTPException(
        status.HTTP_400_BAD_REQUEST,
        "Formato no permitido. Usa JPG, PNG, PDF o WebP.",
    )


def _apply_iata_coords(leg: TripLeg) -> None:
    """Sync: resolve IATA codes to coordinates immediately (no network call)."""
    if leg.mode in ("flight", "train", "bus", "ferry", "other"):
        if not leg.origin_lat and leg.origin:
            coords = airport_service.get_coords(leg.origin)
            if coords:
                leg.origin_lat = Decimal(str(coords[0]))
                leg.origin_lng = Decimal(str(coords[1]))
        if not leg.destination_lat and leg.destination:
            coords = airport_service.get_coords(leg.destination)
            if coords:
                leg.destination_lat = Decimal(str(coords[0]))
                leg.destination_lng = Decimal(str(coords[1]))


async def geocode_leg_bg(leg_id: UUID) -> None:
    """Background task: geocode missing coords via Nominatim (own session + commit)."""
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(TripLeg).where(TripLeg.id == leg_id))
            leg = result.scalar_one_or_none()
            if not leg:
                return
            dirty = False

            if leg.mode == "accommodation":
                if not leg.accommodation_lat and (leg.accommodation_address or leg.accommodation_name):
                    query = leg.accommodation_address or leg.accommodation_name
                    coords = await geocoding_service.geocode(query)  # type: ignore[arg-type]
                    if coords:
                        leg.accommodation_lat = Decimal(str(coords[0]))
                        leg.accommodation_lng = Decimal(str(coords[1]))
                        dirty = True

            elif leg.mode == "car_rental":
                if not leg.pickup_lat and leg.pickup_location:
                    coords = await geocoding_service.geocode(leg.pickup_location)
                    if coords:
                        leg.pickup_lat = Decimal(str(coords[0]))
                        leg.pickup_lng = Decimal(str(coords[1]))
                        dirty = True
                if not leg.dropoff_lat and leg.dropoff_location:
                    coords = await geocoding_service.geocode(leg.dropoff_location)
                    if coords:
                        leg.dropoff_lat = Decimal(str(coords[0]))
                        leg.dropoff_lng = Decimal(str(coords[1]))
                        dirty = True

            else:  # flight | train | bus | ferry | other
                if not leg.origin_lat and leg.origin:
                    coords = airport_service.get_coords(leg.origin) or await geocoding_service.geocode(leg.origin)
                    if coords:
                        leg.origin_lat = Decimal(str(coords[0]))
                        leg.origin_lng = Decimal(str(coords[1]))
                        dirty = True
                if not leg.destination_lat and leg.destination:
                    coords = airport_service.get_coords(leg.destination) or await geocoding_service.geocode(leg.destination)
                    if coords:
                        leg.destination_lat = Decimal(str(coords[0]))
                        leg.destination_lng = Decimal(str(coords[1]))
                        dirty = True

            if dirty:
                if dist := _maybe_compute_distance(leg):
                    leg.distance_km = dist
                await db.commit()
                logger.info("geocode_leg_bg: leg=%s actualizado con coords", leg_id)
        except Exception as exc:
            await db.rollback()
            logger.warning("geocode_leg_bg: failed for leg=%s: %s", leg_id, exc)


async def list_legs(db: AsyncSession, trip_id: UUID, user_id: UUID) -> list[TripLeg]:
    await get_trip_or_404(db, trip_id, user_id)
    result = await db.execute(
        select(TripLeg)
        .where(TripLeg.trip_id == trip_id)
        .order_by(
            func.coalesce(
                TripLeg.departure_local,
                TripLeg.check_in,
                TripLeg.pickup_datetime,
                TripLeg.created_at,
            )
        )
    )
    return list(result.scalars().all())


async def create(db: AsyncSession, trip_id: UUID, user_id: UUID, data: TripLegCreate) -> TripLeg:
    await get_trip_or_404(db, trip_id, user_id)
    leg = TripLeg(trip_id=trip_id, **data.model_dump())
    _apply_iata_coords(leg)
    if dist := _maybe_compute_distance(leg):
        leg.distance_km = dist
    db.add(leg)
    await db.flush()
    await db.refresh(leg)
    return leg


async def update(
    db: AsyncSession, trip_id: UUID, leg_id: UUID, user_id: UUID, data: TripLegUpdate
) -> TripLeg:
    leg = await _get_leg_or_404(db, trip_id, leg_id, user_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(leg, field, value)
    _apply_iata_coords(leg)
    if dist := _maybe_compute_distance(leg):
        leg.distance_km = dist
    await db.commit()
    await db.refresh(leg)
    return leg


async def delete(db: AsyncSession, trip_id: UUID, leg_id: UUID, user_id: UUID) -> None:
    leg = await _get_leg_or_404(db, trip_id, leg_id, user_id)
    if leg.document_path:
        try:
            await aiofiles.os.remove(leg.document_path)
        except FileNotFoundError:
            pass
    await db.delete(leg)


async def update_pending(
    db: AsyncSession, leg_id: UUID, user_id: UUID, data: TripLegUpdate
) -> TripLeg | None:
    result = await db.execute(
        select(TripLeg).where(
            TripLeg.id == leg_id,
            TripLeg.user_id == user_id,
            TripLeg.trip_id.is_(None),
        )
    )
    leg = result.scalar_one_or_none()
    if not leg:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(leg, field, value)
    _apply_iata_coords(leg)
    if dist := _maybe_compute_distance(leg):
        leg.distance_km = dist
    await db.commit()
    await db.refresh(leg)
    return leg


async def discard_pending(db: AsyncSession, leg_id: UUID, user_id: UUID) -> None:
    result = await db.execute(
        select(TripLeg).where(
            TripLeg.id == leg_id,
            TripLeg.user_id == user_id,
            TripLeg.trip_id.is_(None),
        )
    )
    leg = result.scalar_one_or_none()
    if not leg:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tramo pendiente no encontrado")
    if leg.document_path:
        try:
            await aiofiles.os.remove(leg.document_path)
        except FileNotFoundError:
            pass
    await db.delete(leg)
    await db.commit()


async def upload_document(
    db: AsyncSession, trip_id: UUID, leg_id: UUID, user_id: UUID, file: UploadFile
) -> TripLeg:
    leg = await _get_leg_or_404(db, trip_id, leg_id, user_id)
    content = await file.read()
    ext = _validate_and_get_ext(content, file.filename)
    await aiofiles.os.makedirs(_LEGS_DIR, exist_ok=True)
    file_path = str(_LEGS_DIR / f"{leg_id}{ext}")
    if leg.document_path and leg.document_path != file_path:
        try:
            await aiofiles.os.remove(leg.document_path)
        except FileNotFoundError:
            pass
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)
    leg.document_path = file_path
    await db.flush()
    await db.refresh(leg)
    return leg


async def get_document_path(
    db: AsyncSession, trip_id: UUID, leg_id: UUID, user_id: UUID
) -> str:
    leg = await _get_leg_or_404(db, trip_id, leg_id, user_id)
    if not leg.document_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No hay documento adjunto a este tramo")
    return leg.document_path


async def geocode_pending(db: AsyncSession, trip_id: UUID, user_id: UUID) -> list[UUID]:
    """Return IDs of all legs for this trip that are missing at least one coordinate."""
    await get_trip_or_404(db, trip_id, user_id)
    result = await db.execute(select(TripLeg).where(TripLeg.trip_id == trip_id))
    legs = result.scalars().all()
    pending: list[UUID] = []
    for leg in legs:
        if leg.mode == "accommodation":
            if not leg.accommodation_lat:
                pending.append(leg.id)
        elif leg.mode == "car_rental":
            if not leg.pickup_lat or not leg.dropoff_lat:
                pending.append(leg.id)
        else:
            if not leg.origin_lat or not leg.destination_lat:
                pending.append(leg.id)
    return pending


async def _get_leg_or_404(
    db: AsyncSession, trip_id: UUID, leg_id: UUID, user_id: UUID
) -> TripLeg:
    await get_trip_or_404(db, trip_id, user_id)
    result = await db.execute(
        select(TripLeg).where(TripLeg.id == leg_id, TripLeg.trip_id == trip_id)
    )
    leg = result.scalar_one_or_none()
    if not leg:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"TripLeg {leg_id} not found")
    return leg
