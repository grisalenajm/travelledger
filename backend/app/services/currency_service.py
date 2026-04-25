import logging
from datetime import date
from decimal import Decimal

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exchange_rate import ExchangeRate

logger = logging.getLogger(__name__)

EXCHANGE_RATE_API = "https://api.exchangerate.host"


async def convert(
    db: AsyncSession,
    amount: Decimal,
    from_currency: str,
    to_currency: str,
    rate_date: date,
) -> tuple[Decimal, date]:
    """
    Devuelve (amount_convertido, rate_date).
    Cachea en ExchangeRate. Llama a exchangerate.host solo si no hay caché.
    """
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()

    # Mismo par → sin conversión
    if from_currency == to_currency:
        return amount.quantize(Decimal("0.01")), rate_date

    # Buscar en caché
    result = await db.execute(
        select(ExchangeRate).where(
            ExchangeRate.from_currency == from_currency,
            ExchangeRate.to_currency == to_currency,
            ExchangeRate.date == rate_date,
        )
    )
    cached = result.scalar_one_or_none()

    if cached:
        return (amount * cached.rate).quantize(Decimal("0.01")), cached.date

    # Llamar API externa
    try:
        rate = await _fetch_rate(from_currency, to_currency, rate_date)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("currency conversion failed: %s", e)
        raise HTTPException(503, "Exchange rate service unavailable")

    # Guardar en caché
    exchange_rate = ExchangeRate(
        from_currency=from_currency,
        to_currency=to_currency,
        rate=rate,
        date=rate_date,
    )
    db.add(exchange_rate)
    await db.flush()

    return (amount * rate).quantize(Decimal("0.01")), rate_date


async def _fetch_rate(from_currency: str, to_currency: str, rate_date: date) -> Decimal:
    url = f"{EXCHANGE_RATE_API}/convert"
    params = {
        "from": from_currency,
        "to": to_currency,
        "amount": "1",
        "date": rate_date.isoformat(),
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            if not data.get("success"):
                raise ValueError("API returned success=false")
            return Decimal(str(data["result"]))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("exchangerate.host failed: %s", e)
        raise HTTPException(503, "Exchange rate service unavailable")


async def get_rates(
    db: AsyncSession,
    base: str,
    symbols: list[str],
    rate_date: date,
) -> dict[str, Decimal]:
    """Obtiene múltiples tipos para el dashboard. Usa caché por par."""
    rates: dict[str, Decimal] = {}
    for symbol in symbols:
        if symbol == base:
            rates[symbol] = Decimal("1")
            continue
        converted, _ = await convert(db, Decimal("1"), base, symbol, rate_date)
        rates[symbol] = converted
    return rates
