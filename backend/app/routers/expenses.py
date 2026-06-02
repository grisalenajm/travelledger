from datetime import date as date_t
from decimal import Decimal
from pathlib import Path
from uuid import UUID

import aiofiles
import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_effective_user_id, require_not_guest
from app.database import get_db
from app.models.user import User
from app.schemas.expense import ExpenseCreate, ExpenseRead, ExpenseUpdate
from app.services import expense_service, geocoding_service, paperless_service
from sqlalchemy import select
from app.models.expense import Expense

router = APIRouter(prefix="/api/expenses", tags=["expenses"], redirect_slashes=False)


@router.get("", response_model=list[ExpenseRead])
async def list_expenses(
    trip_id: UUID | None = Query(default=None),
    billable: bool | None = Query(default=None),
    category: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    effective_id: UUID = Depends(get_effective_user_id),
):
    return await expense_service.list_expenses(
        db, effective_id, trip_id, billable, category, date_from, date_to
    )


@router.post("", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
async def create_expense(
    trip_id: UUID = Form(...),
    amount: Decimal = Form(...),
    currency: str = Form(...),
    category: str = Form(...),
    date: date_t = Form(...),
    description: str | None = Form(None),
    payment_method_id: UUID | None = Form(None),
    billable: bool = Form(True),
    loyalty_card_id: UUID | None = Form(None),
    id: UUID | None = Form(None),
    location_name: str | None = Form(None),
    image: UploadFile | None = File(None),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_not_guest),
):
    data = ExpenseCreate(
        id=id, trip_id=trip_id, amount=amount, currency=currency,
        category=category, date=date, description=description,
        payment_method_id=payment_method_id, billable=billable,
        loyalty_card_id=loyalty_card_id, location_name=location_name,
    )
    expense = await expense_service.create(db, user, data, image=image)
    if expense.location_lat is None and expense.location_name:
        background_tasks.add_task(expense_service.geocode_expense_bg, expense.id, expense.location_name)
    return expense


@router.post("/geocode-pending")
async def geocode_pending(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Queue background geocoding for all expenses with location_name but no coords."""
    result = await db.execute(
        select(Expense).where(
            Expense.user_id == user.id,
            Expense.location_name.is_not(None),
            Expense.location_lat.is_(None),
        )
    )
    pending = list(result.scalars().all())
    for exp in pending:
        background_tasks.add_task(expense_service.geocode_expense_bg, exp.id, exp.location_name)
    return {"queued": len(pending)}


@router.get("/{expense_id}", response_model=ExpenseRead)
async def get_expense(
    expense_id: UUID,
    db: AsyncSession = Depends(get_db),
    effective_id: UUID = Depends(get_effective_user_id),
):
    return await expense_service.get_or_404(db, expense_id, effective_id)


@router.put("/{expense_id}", response_model=ExpenseRead)
async def update_expense(
    expense_id: UUID,
    data: ExpenseUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_not_guest),
):
    expense = await expense_service.update(db, expense_id, user, data)
    if data.location_name is not None and expense.location_lat is None:
        background_tasks.add_task(expense_service.geocode_expense_bg, expense.id, data.location_name)
    return expense


@router.post("/{expense_id}/geocode", response_model=ExpenseRead)
async def geocode_expense(
    expense_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    expense = await expense_service.get_or_404(db, expense_id, user.id)
    if not expense.location_name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El gasto no tiene nombre de ubicación para geocodificar")
    coords = await geocoding_service.geocode(expense.location_name)
    if coords:
        expense.location_lat = Decimal(str(coords[0]))
        expense.location_lng = Decimal(str(coords[1]))
        await db.flush()
        await db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    expense_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_not_guest),
):
    await expense_service.delete(db, expense_id, user.id)


@router.get("/{expense_id}/receipt-url")
async def get_receipt_url(
    expense_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    expense = await expense_service.get_or_404(db, expense_id, user.id)
    if not expense.paperless_doc_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No receipt attached")
    url = await paperless_service.get_url(expense.paperless_doc_id, db, user.id)
    return {"url": url}


@router.get("/{expense_id}/receipt-image")
async def get_receipt_image(
    expense_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    expense = await expense_service.get_or_404(db, expense_id, user.id)

    # Local file is always available immediately (fire-and-forget means paperless_doc_id may not be set yet)
    if expense.local_path:
        local = Path(expense.local_path)
        if local.exists():
            mime_map = {
                ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                ".png": "image/png", ".webp": "image/webp",
                ".pdf": "application/pdf",
            }
            content_type = mime_map.get(local.suffix.lower(), "application/octet-stream")
            async with aiofiles.open(local, "rb") as f:
                data = await f.read()
            return StreamingResponse(
                iter([data]),
                media_type=content_type,
                headers={"Cache-Control": "private, max-age=3600"},
            )

    # Fallback: try Paperless if local file is missing
    if expense.paperless_doc_id:
        paperless_url, token = await paperless_service.get_credentials(db, user.id)
        if paperless_url and token:
            image_url = f"{paperless_url.rstrip('/')}/api/documents/{expense.paperless_doc_id}/download/"
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    image_url,
                    headers={"Authorization": f"Token {token}"},
                    follow_redirects=True,
                )
            if resp.status_code == 200:
                content_type = resp.headers.get("content-type", "application/octet-stream")
                return StreamingResponse(
                    iter([resp.content]),
                    media_type=content_type,
                    headers={"Cache-Control": "private, max-age=3600"},
                )

    raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No receipt attached")
