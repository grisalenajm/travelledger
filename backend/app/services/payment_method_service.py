from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.models.payment_method import PaymentMethod

_SEED_NAMES = ["Efectivo", "Tarjeta"]


async def seed_defaults(db: AsyncSession, user_id: UUID) -> None:
    """Create default payment methods for a new user."""
    for name in _SEED_NAMES:
        db.add(PaymentMethod(user_id=user_id, name=name))
    await db.flush()


async def list_payment_methods(db: AsyncSession, user_id: UUID) -> list[PaymentMethod]:
    result = await db.execute(
        select(PaymentMethod)
        .where(PaymentMethod.user_id == user_id)
        .order_by(PaymentMethod.created_at)
    )
    return list(result.scalars().all())


async def create_payment_method(db: AsyncSession, user_id: UUID, name: str) -> PaymentMethod:
    name = name.strip()
    existing = await db.scalar(
        select(PaymentMethod).where(
            PaymentMethod.user_id == user_id,
            func.lower(PaymentMethod.name) == name.lower(),
        )
    )
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Ya existe un método llamado '{name}'")
    pm = PaymentMethod(user_id=user_id, name=name)
    db.add(pm)
    await db.commit()
    await db.refresh(pm)
    return pm


async def delete_payment_method(db: AsyncSession, pm_id: UUID, user_id: UUID) -> None:
    result = await db.execute(
        select(PaymentMethod).where(
            PaymentMethod.id == pm_id,
            PaymentMethod.user_id == user_id,
        )
    )
    pm = result.scalar_one_or_none()
    if not pm:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Método de pago no encontrado")

    expense_count = await db.scalar(
        select(func.count()).select_from(Expense).where(Expense.payment_method_id == pm_id)
    )
    if expense_count and expense_count > 0:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"No se puede eliminar: {expense_count} gasto(s) usan este método",
        )

    await db.delete(pm)
    await db.commit()
