from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.currency import ConvertResponse, RatesResponse
from app.services import currency_service

COMMON_CURRENCIES = [
    "EUR", "USD", "GBP", "CHF", "JPY", "ARS", "BRL",
    "MXN", "CAD", "AUD", "CNY", "INR",
]

router = APIRouter(prefix="/api/currencies", tags=["currencies"])


@router.get("/rates", response_model=RatesResponse)
async def get_rates(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = date.today()
    rates = await currency_service.get_rates(db, user.currency_base, COMMON_CURRENCIES, today)
    return RatesResponse(base=user.currency_base, date=today, rates=rates)


@router.get("/convert", response_model=ConvertResponse)
async def convert(
    amount: Decimal = Query(gt=0),
    from_currency: str = Query(min_length=3, max_length=3),
    to_currency: str = Query(min_length=3, max_length=3),
    rate_date: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    d = rate_date or date.today()
    result, actual_date = await currency_service.convert(db, amount, from_currency, to_currency, d)
    rate_result, _ = await currency_service.convert(
        db, Decimal("1"), from_currency, to_currency, d
    )
    return ConvertResponse(
        from_currency=from_currency.upper(),
        to_currency=to_currency.upper(),
        amount=amount,
        result=result,
        rate=rate_result,
        rate_date=actual_date,
    )
