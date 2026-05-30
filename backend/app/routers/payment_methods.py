from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.services import payment_method_service

router = APIRouter(prefix="/api/payment-methods", tags=["payment-methods"], redirect_slashes=False)


class PaymentMethodRead(BaseModel):
    id: UUID
    name: str

    model_config = {"from_attributes": True}


class PaymentMethodCreate(BaseModel):
    name: str


@router.get("", response_model=list[PaymentMethodRead])
async def list_payment_methods(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await payment_method_service.list_payment_methods(db, user.id)


@router.post("", response_model=PaymentMethodRead, status_code=status.HTTP_201_CREATED)
async def create_payment_method(
    data: PaymentMethodCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await payment_method_service.create_payment_method(db, user.id, data.name)


@router.delete("/{pm_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment_method(
    pm_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await payment_method_service.delete_payment_method(db, pm_id, user.id)
