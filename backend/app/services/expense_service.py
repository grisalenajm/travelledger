import io
import logging
from datetime import date
from decimal import Decimal
from pathlib import Path
from uuid import UUID, uuid4

import aiofiles
import aiofiles.os
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.models.user import User
from app.schemas.expense import ExpenseCreate, ExpenseUpdate
from app.services import currency_service, geocoding_service, paperless_service, settings_service
from app.services.trip_service import get_or_404 as get_trip_or_404

logger = logging.getLogger(__name__)


def extract_exif_gps(content: bytes) -> tuple[float, float] | None:
    """Return (lat, lng) from image EXIF GPS data, or None if not present.

    Uses getexif().get_ifd(0x8825) with direct numeric GPS tag keys so that
    IFDRational values from Android cameras are handled correctly by float().
    Returns None explicitly when any required GPS tag is missing.
    """
    try:
        from PIL import Image

        img = Image.open(io.BytesIO(content))
        exif_data = img.getexif()
        if not exif_data:
            return None
        gps_ifd = exif_data.get_ifd(0x8825)
        if not gps_ifd:
            return None

        # GPS tag IDs: 1=LatRef, 2=Lat, 3=LngRef, 4=Lng
        lat_vals = gps_ifd.get(2)
        lat_ref = gps_ifd.get(1)
        lng_vals = gps_ifd.get(4)
        lng_ref = gps_ifd.get(3)

        if not all([lat_vals, lat_ref, lng_vals, lng_ref]):
            return None

        def to_decimal(dms, ref: str) -> float:
            d, m, s = float(dms[0]), float(dms[1]), float(dms[2])
            result = d + m / 60 + s / 3600
            return round(-result if ref in ("S", "W") else result, 6)

        lat = to_decimal(lat_vals, lat_ref)
        lng = to_decimal(lng_vals, lng_ref)

        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            return None

        return lat, lng
    except Exception:
        return None


async def geocode_expense_bg(expense_id: UUID, query: str) -> None:
    """Background task: geocodificar via Nominatim y escribir lat/lng/name SOLO si hay resultado.

    Regla: si Nominatim devuelve None → no se escribe nada (silencio total).
    Solo cuando hay coords reales se escriben los tres campos: lat, lng Y location_name.
    """
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(Expense).where(Expense.id == expense_id))
            expense = result.scalar_one_or_none()
            if not expense:
                return
            if expense.location_lat is not None:
                # Ya tiene coords (p. ej. EXIF GPS) — no sobrescribir
                return

            coords = await geocoding_service.geocode(query)
            if not coords:
                # Nominatim no encontró nada — silencio total, no tocar ningún campo
                logger.debug("geocode_expense_bg: sin resultado para '%s' (expense=%s)", query, expense_id)
                return

            expense.location_lat = Decimal(str(coords[0]))
            expense.location_lng = Decimal(str(coords[1]))
            expense.location_name = query  # escribir nombre solo si hay coords reales
            await db.commit()
            logger.info(
                "geocode_expense_bg: expense=%s → %.6f, %.6f name='%s'",
                expense_id, coords[0], coords[1], query,
            )
        except Exception as exc:
            await db.rollback()
            logger.warning("geocode_expense_bg: failed for expense=%s: %s", expense_id, exc)


async def _save_local_image(content: bytes, user_id: UUID, expense_id: UUID, filename: str | None) -> str:
    ext = Path(filename).suffix.lower() if filename else ".bin"
    dir_path = f"/app/uploads/{user_id}"
    await aiofiles.os.makedirs(dir_path, exist_ok=True)
    file_path = f"{dir_path}/{expense_id}{ext}"
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)
    return file_path


async def list_expenses(
    db: AsyncSession,
    user_id: UUID,
    trip_id: UUID | None = None,
    billable: bool | None = None,
    category: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[Expense]:
    q = select(Expense).where(Expense.user_id == user_id)
    if trip_id:
        q = q.where(Expense.trip_id == trip_id)
    if billable is not None:
        q = q.where(Expense.billable == billable)
    if category:
        q = q.where(Expense.category == category)
    if date_from:
        from datetime import date as _d
        q = q.where(Expense.date >= (_d.fromisoformat(date_from) if isinstance(date_from, str) else date_from))
    if date_to:
        from datetime import date as _d
        q = q.where(Expense.date <= (_d.fromisoformat(date_to) if isinstance(date_to, str) else date_to))
    result = await db.execute(q.order_by(Expense.date.desc()))
    return list(result.scalars().all())


async def get_with_local_path(db: AsyncSession, user_id: UUID) -> list[Expense]:
    result = await db.execute(
        select(Expense).where(Expense.user_id == user_id, Expense.local_path.is_not(None))
    )
    return list(result.scalars().all())


async def create(
    db: AsyncSession, user: User, data: ExpenseCreate, image: UploadFile | None = None
) -> Expense:
    if data.id is not None:
        existing = await db.get(Expense, data.id)
        if existing and existing.user_id == user.id:
            return existing

    trip = await get_trip_or_404(db, data.trip_id, user.id)

    amount_base, rate_date = await currency_service.convert(
        db, data.amount, data.currency, user.currency_base, data.date
    )

    expense_id = data.id or uuid4()
    paperless_doc_id = None
    local_path = None

    exif_coords: tuple[float, float] | None = None
    if image:
        content = await image.read()
        exif_coords = extract_exif_gps(content)
        # Only use Paperless when explicitly enabled for the user
        paperless_enabled = await settings_service.get(db, user.id, "paperless_enabled")
        if paperless_enabled == "true":
            paperless_url, paperless_token = await paperless_service.get_credentials(db, user.id)
            if paperless_url and paperless_token:
                try:
                    paperless_doc_id = await paperless_service.upload_document(
                        content,
                        image.filename or "receipt",
                        image.content_type or "application/octet-stream",
                        db,
                        user.id,
                        title_parts={
                            "category": data.category,
                            "date": str(data.date),
                            "trip_name": trip.name,
                        },
                    )
                except Exception as e:
                    logger.warning("Paperless upload failed, saving locally: %s", e)
                    local_path = await _save_local_image(content, user.id, expense_id, image.filename)
            else:
                local_path = await _save_local_image(content, user.id, expense_id, image.filename)
        else:
            local_path = await _save_local_image(content, user.id, expense_id, image.filename)

    expense = Expense(
        id=expense_id,
        user_id=user.id,
        amount_base=amount_base,
        rate_date=rate_date,
        paperless_doc_id=paperless_doc_id,
        local_path=local_path,
        **data.model_dump(exclude={"id"}),
    )
    if exif_coords and expense.location_lat is None:
        expense.location_lat = Decimal(str(exif_coords[0]))
        expense.location_lng = Decimal(str(exif_coords[1]))
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    return expense


async def get_or_404(db: AsyncSession, expense_id: UUID, user_id: UUID) -> Expense:
    result = await db.execute(
        select(Expense).where(Expense.id == expense_id, Expense.user_id == user_id)
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Expense {expense_id} not found")
    return expense


async def update(
    db: AsyncSession, expense_id: UUID, user: User, data: ExpenseUpdate
) -> Expense:
    expense = await get_or_404(db, expense_id, user.id)

    updates = data.model_dump(exclude_unset=True)

    # Si cambia amount, currency o date → recalcular amount_base
    recalc_fields = {"amount", "currency", "date"}
    if recalc_fields & updates.keys():
        new_amount = updates.get("amount", expense.amount)
        new_currency = updates.get("currency", expense.currency)
        new_date = updates.get("date", expense.date)
        amount_base, rate_date = await currency_service.convert(
            db, new_amount, new_currency, user.currency_base, new_date
        )
        updates["amount_base"] = amount_base
        updates["rate_date"] = rate_date

    for field, value in updates.items():
        setattr(expense, field, value)

    expense.is_draft = False

    await db.commit()
    await db.refresh(expense)
    return expense


async def delete(db: AsyncSession, expense_id: UUID, user_id: UUID) -> None:
    expense = await get_or_404(db, expense_id, user_id)
    if expense.paperless_doc_id:
        try:
            paperless_url, token = await paperless_service.get_credentials(db, user_id)
            if paperless_url and token:
                await paperless_service.delete_document(
                    paperless_url=paperless_url,
                    token=token,
                    doc_id=expense.paperless_doc_id,
                )
                logger.info(
                    "Paperless delete — doc_id=%s para expense=%s",
                    expense.paperless_doc_id, expense_id,
                )
        except Exception as e:
            logger.warning(
                "Paperless delete falló para doc_id=%s: %s — continuando con borrado local",
                expense.paperless_doc_id, e,
            )
    if expense.local_path:
        Path(expense.local_path).unlink(missing_ok=True)
    await db.delete(expense)
