from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loyalty_card import LoyaltyCard
from app.schemas.loyalty_card import LoyaltyCardCreate, LoyaltyCardUpdate


async def list_cards(db: AsyncSession, user_id: UUID) -> list[LoyaltyCard]:
    result = await db.execute(
        select(LoyaltyCard).where(LoyaltyCard.user_id == user_id)
    )
    return list(result.scalars().all())


async def create(db: AsyncSession, user_id: UUID, data: LoyaltyCardCreate) -> LoyaltyCard:
    card = LoyaltyCard(user_id=user_id, **data.model_dump())
    db.add(card)
    await db.flush()
    await db.refresh(card)
    return card


async def update(
    db: AsyncSession, card_id: UUID, user_id: UUID, data: LoyaltyCardUpdate
) -> LoyaltyCard:
    card = await _get_or_404(db, card_id, user_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(card, field, value)
    await db.flush()
    await db.refresh(card)
    return card


async def delete(db: AsyncSession, card_id: UUID, user_id: UUID) -> None:
    card = await _get_or_404(db, card_id, user_id)
    await db.delete(card)


async def _get_or_404(db: AsyncSession, card_id: UUID, user_id: UUID) -> LoyaltyCard:
    result = await db.execute(
        select(LoyaltyCard).where(
            LoyaltyCard.id == card_id, LoyaltyCard.user_id == user_id
        )
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"LoyaltyCard {card_id} not found")
    return card
