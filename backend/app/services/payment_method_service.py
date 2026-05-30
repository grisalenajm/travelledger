from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
    pm = PaymentMethod(user_id=user_id, name=name.strip())
    db.add(pm)
    await db.flush()
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
    await db.delete(pm)
