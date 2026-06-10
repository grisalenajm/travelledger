import logging
from datetime import date
from decimal import Decimal

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exchange_rate import ExchangeRate

logger = logging.getLogger(__name__)


async def convert(
    db: AsyncSession,
    amount: Decimal,
    from_currency: str,
    to_currency: str,
    rate_date: date,
) -> tuple[Decimal, date]:
    """
    Devuelve (amount_convertido, rate_date).
    Cachea en ExchangeRate. Llama a open.er-api.com solo si no hay caché.
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


# Tabla completa de tipos por divisa base, cacheada en memoria por día natural.
# open.er-api.com devuelve TODAS las divisas en una llamada — sin esta caché,
# un día con gastos en 3 monedas distintas hacía 3 llamadas HTTP idénticas.
_latest_rates: dict[str, tuple[date, dict[str, Decimal]]] = {}


async def _fetch_all_rates(base: str) -> dict[str, Decimal]:
    url = f"https://open.er-api.com/v6/latest/{base.upper()}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        data = response.json()
        if data.get("result") != "success":
            raise ValueError("API returned non-success")
        return {symbol: Decimal(str(rate)) for symbol, rate in data["rates"].items()}


async def _fetch_rate(from_currency: str, to_currency: str, rate_date: date) -> Decimal:
    try:
        today = date.today()
        cached = _latest_rates.get(from_currency)
        if cached is None or cached[0] != today:
            if len(_latest_rates) > 20:
                _latest_rates.clear()
            rates = await _fetch_all_rates(from_currency)
            _latest_rates[from_currency] = (today, rates)
            cached = (today, rates)
        rate = cached[1].get(to_currency.upper())
        if rate is None:
            raise ValueError(f"Rate not found for {to_currency}")
        return rate
    except Exception as e:
        logger.error(f"open.er-api.com failed: {e}")
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
