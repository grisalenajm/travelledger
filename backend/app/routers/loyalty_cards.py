from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession


from app.core.dependencies import get_current_user, get_effective_user_id, require_not_guest
from app.database import get_db
from app.models.user import User
from app.schemas.loyalty_card import LoyaltyCardCreate, LoyaltyCardRead, LoyaltyCardUpdate
from app.services import loyalty_card_service

router = APIRouter(prefix="/api/loyalty-cards", tags=["loyalty-cards"], redirect_slashes=False)


@router.get("", response_model=list[LoyaltyCardRead])
async def list_cards(
    db: AsyncSession = Depends(get_db),
    effective_id: UUID = Depends(get_effective_user_id),
):
    return await loyalty_card_service.list_cards(db, effective_id)


@router.post("", response_model=LoyaltyCardRead, status_code=status.HTTP_201_CREATED)
async def create_card(
    data: LoyaltyCardCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_not_guest),
):
    return await loyalty_card_service.create(db, user.id, data)


@router.put("/{card_id}", response_model=LoyaltyCardRead)
async def update_card(
    card_id: UUID,
    data: LoyaltyCardUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_not_guest),
):
    return await loyalty_card_service.update(db, card_id, user.id, data)


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_card(
    card_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_not_guest),
):
    await loyalty_card_service.delete(db, card_id, user.id)
