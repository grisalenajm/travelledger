import logging
from datetime import date as date_t
from decimal import Decimal
from uuid import UUID

import aiofiles
import aiofiles.os
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_not_guest
from app.database import get_db
from app.models.expense import Expense
from app.models.user import User
from app.schemas.expense import ExpenseRead
from app.services import currency_service, paperless_service, settings_service
from app.services.expense_service import extract_exif_gps, geocode_expense_bg
from app.services.ocr_factory import get_ocr_provider
from app.services.ocr_providers.base import OcrProviderNotConfiguredError
from app.services.trip_service import get_or_404 as get_trip_or_404

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/receipts", tags=["receipts"], redirect_slashes=False)


def _detect_mime(data: bytes) -> str | None:
    if len(data) < 12:
        return None
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:4] == b"%PDF":
        return "application/pdf"
    return None


async def _save_local(content: bytes, user_id: UUID, expense_id: UUID, mime_type: str) -> str:
    ext = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf"}.get(mime_type, ".bin")
    dir_path = f"/app/uploads/{user_id}"
    await aiofiles.os.makedirs(dir_path, exist_ok=True)
    file_path = f"{dir_path}/{expense_id}{ext}"
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)
    return file_path


@router.post("/upload", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
async def upload_receipt(
    file: UploadFile = File(...),
    trip_id: UUID = Form(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_not_guest),
):
    content = await file.read()
    mime_type = _detect_mime(content)
    if mime_type is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Unsupported file type. Upload JPEG, PNG, WebP or PDF.",
        )

    trip = await get_trip_or_404(db, trip_id, user.id)

    try:
        provider = await get_ocr_provider(db, user.id)
    except OcrProviderNotConfiguredError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))

    ocr = await provider.extract(content, mime_type)
    logger.info(
        "OCR complete trip_id=%s confidence=%.2f date=%s amount=%s currency=%s",
        trip_id, ocr.confidence, ocr.date, ocr.amount, ocr.currency,
    )

    # 1. Intentar GPS EXIF de la imagen (solo para imágenes, no PDFs)
    exif_coords: tuple[float, float] | None = None
    if mime_type != "application/pdf":
        exif_coords = extract_exif_gps(content)
        if exif_coords:
            logger.info("OCR upload: GPS EXIF encontrado → %.6f, %.6f", exif_coords[0], exif_coords[1])

    from uuid import uuid4
    expense_id = uuid4()

    paperless_doc_id: int | None = None
    paperless_warning: str | None = None

    ext = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf"}.get(mime_type, ".jpg")
    unique_filename = f"{expense_id}{ext}"

    # Always save locally as backup first
    local_path = await _save_local(content, user.id, expense_id, mime_type)

    # Fire-and-forget to Paperless — no polling, return immediately
    paperless_enabled = await settings_service.get(db, user.id, "paperless_enabled")
    if paperless_enabled == "true":
        queued = await paperless_service.upload_document_queued(
            content,
            unique_filename,
            mime_type,
            db,
            user.id,
            title_parts={
                "category": ocr.category or "Other",
                "date": str(ocr.date or date_t.today()),
                "trip_name": trip.name,
            },
        )
        if not queued:
            paperless_warning = "No se pudo enviar a Paperless. El documento se ha guardado localmente."

    expense_date = ocr.date or date_t.today()
    expense_currency = ocr.currency or trip.primary_currency
    expense_amount = ocr.amount if ocr.amount is not None else Decimal("0")

    if expense_amount > 0:
        amount_base, rate_date = await currency_service.convert(
            db, expense_amount, expense_currency, user.currency_base, expense_date
        )
    else:
        amount_base = Decimal("0")
        rate_date = expense_date

    # Determinar localización: EXIF GPS tiene prioridad sobre Nominatim.
    # REGLA: location_name/lat/lng solo se rellenan si hay coords REALES.
    # Si ninguna fuente devuelve coords → los tres campos quedan a None (silencio total).
    location_lat: Decimal | None = None
    location_lng: Decimal | None = None
    location_name: str | None = None  # NO asignar merchant aquí — solo si hay coords

    if exif_coords:
        location_lat = Decimal(str(exif_coords[0]))
        location_lng = Decimal(str(exif_coords[1]))
        # location_name permanece None — no tenemos nombre textual del GPS

    expense = Expense(
        id=expense_id,
        trip_id=trip_id,
        user_id=user.id,
        date=expense_date,
        amount=expense_amount,
        currency=expense_currency,
        amount_base=amount_base,
        rate_date=rate_date,
        category=ocr.category or "Other",
        description=ocr.description,
        paperless_doc_id=paperless_doc_id,
        local_path=local_path,
        is_draft=True,
        ocr_raw=ocr.raw_text,
        ocr_confidence=ocr.confidence,
        billable=True,
        location_lat=location_lat,
        location_lng=location_lng,
        location_name=location_name,
    )
    db.add(expense)
    await db.flush()
    await db.commit()
    await db.refresh(expense)

    # 2. Si no hay GPS EXIF y el OCR extrajo un merchant, intentar Nominatim en background.
    # geocode_expense_bg escribe lat/lng/name SOLO si Nominatim devuelve coords.
    if location_lat is None and ocr.description:
        background_tasks.add_task(geocode_expense_bg, expense.id, ocr.description)
        logger.info("OCR upload: geocoding background para merchant='%s'", ocr.description)

    expense_data = jsonable_encoder(ExpenseRead.model_validate(expense))
    if paperless_warning:
        expense_data["warning"] = paperless_warning
    return JSONResponse(content=expense_data, status_code=status.HTTP_201_CREATED)
