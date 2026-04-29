import logging
from datetime import date as date_t
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.expense import Expense
from app.models.user import User
from app.schemas.expense import ExpenseRead
from app.services import currency_service, ocr_service, paperless_service
from app.services.paperless_service import PaperlessDuplicateError
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


@router.post("/upload", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
async def upload_receipt(
    file: UploadFile = File(...),
    trip_id: UUID = Form(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    content = await file.read()
    mime_type = _detect_mime(content)
    if mime_type is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Unsupported file type. Upload JPEG, PNG, WebP or PDF.",
        )

    trip = await get_trip_or_404(db, trip_id, user.id)

    ocr = await ocr_service.extract(content, mime_type)
    logger.info(
        "OCR complete trip_id=%s confidence=%.2f date=%s amount=%s currency=%s",
        trip_id, ocr.confidence, ocr.date, ocr.amount, ocr.currency,
    )

    paperless_doc_id: int | None = None
    duplicate_warning = False
    try:
        paperless_doc_id = await paperless_service.upload_document(
            content,
            file.filename or "receipt",
            mime_type,
            db,
            user.id,
            title_parts={
                "category": ocr.category or "Other",
                "date": str(ocr.date or date_t.today()),
                "trip_name": trip.name,
            },
        )
    except PaperlessDuplicateError as exc:
        logger.warning("Paperless duplicate detected, continuing without doc_id: %s", exc)
        duplicate_warning = True
    except Exception as exc:
        logger.warning("Paperless upload failed, continuing without: %s", exc)

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

    expense = Expense(
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
        is_draft=True,
        ocr_raw=ocr.raw_text,
        ocr_confidence=ocr.confidence,
        billable=True,
    )
    db.add(expense)
    await db.flush()
    await db.commit()
    await db.refresh(expense)

    expense_data = jsonable_encoder(ExpenseRead.model_validate(expense))
    response = JSONResponse(content=expense_data, status_code=status.HTTP_201_CREATED)
    if duplicate_warning:
        response.headers["X-Paperless-Warning"] = "duplicate"
    return response
