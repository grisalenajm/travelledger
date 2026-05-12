from datetime import date as date_t
from decimal import Decimal
from pathlib import Path
from uuid import UUID

import aiofiles
import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.expense import ExpenseCreate, ExpenseRead, ExpenseUpdate
from app.services import expense_service, paperless_service

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
):
    return await expense_service.list_expenses(
        db, user.id, trip_id, billable, category, date_from, date_to
    )


@router.post("", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
async def create_expense(
    trip_id: UUID = Form(...),
    amount: Decimal = Form(...),
    currency: str = Form(...),
    category: str = Form(...),
    date: date_t = Form(...),
    description: str | None = Form(None),
    payment_method: str | None = Form(None),
    billable: bool = Form(True),
    loyalty_card_id: UUID | None = Form(None),
    id: UUID | None = Form(None),
    image: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    data = ExpenseCreate(
        id=id, trip_id=trip_id, amount=amount, currency=currency,
        category=category, date=date, description=description,
        payment_method=payment_method, billable=billable,
        loyalty_card_id=loyalty_card_id,
    )
    return await expense_service.create(db, user, data, image=image)


@router.get("/{expense_id}", response_model=ExpenseRead)
async def get_expense(
    expense_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await expense_service.get_or_404(db, expense_id, user.id)


@router.put("/{expense_id}", response_model=ExpenseRead)
async def update_expense(
    expense_id: UUID,
    data: ExpenseUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await expense_service.update(db, expense_id, user, data)


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    expense_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
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

    # Try Paperless first
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

    # Fall back to local file
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

    raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No receipt attached")
