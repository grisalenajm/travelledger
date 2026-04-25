from datetime import date
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.models.user import User
from app.schemas.expense import ExpenseCreate, ExpenseUpdate
from app.services import currency_service
from app.services.trip_service import get_or_404 as get_trip_or_404


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
        q = q.where(Expense.date >= date_from)
    if date_to:
        q = q.where(Expense.date <= date_to)
    result = await db.execute(q.order_by(Expense.date.desc()))
    return list(result.scalars().all())


async def create(db: AsyncSession, user: User, data: ExpenseCreate) -> Expense:
    # Verificar que el trip pertenece al usuario
    await get_trip_or_404(db, data.trip_id, user.id)

    # SIEMPRE convertir a currency_base del usuario, incluso si from == to
    amount_base, rate_date = await currency_service.convert(
        db, data.amount, data.currency, user.currency_base, data.date
    )

    expense = Expense(
        user_id=user.id,
        amount_base=amount_base,
        rate_date=rate_date,
        paperless_doc_id=None,  # Fase 3 lo rellenará
        **data.model_dump(),
    )
    db.add(expense)
    await db.flush()
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

    await db.flush()
    await db.refresh(expense)
    return expense


async def delete(db: AsyncSession, expense_id: UUID, user_id: UUID) -> None:
    expense = await get_or_404(db, expense_id, user_id)
    # paperless_doc_id cascade delete → se implementa en Fase 4
    await db.delete(expense)
