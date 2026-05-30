from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class RatesResponse(BaseModel):
    base: str
    date: date
    rates: dict[str, Decimal]


class ConvertResponse(BaseModel):
    from_currency: str
    to_currency: str
    amount: Decimal
    result: Decimal
    rate: Decimal
    rate_date: date
