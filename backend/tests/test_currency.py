from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest

from app.services import currency_service


@pytest.mark.asyncio
async def test_convert_same_currency_returns_same_amount(db):
    result, rate_date = await currency_service.convert(
        db, Decimal("100.00"), "EUR", "EUR", date(2026, 5, 1)
    )
    assert result == Decimal("100.00")
    assert rate_date == date(2026, 5, 1)


@pytest.mark.asyncio
async def test_convert_caches_rate_in_db(db):
    with patch(
        "app.services.currency_service._fetch_rate",
        new_callable=AsyncMock,
        return_value=Decimal("0.92"),
    ) as mock_fetch:
        result, _ = await currency_service.convert(
            db, Decimal("100.00"), "USD", "EUR", date(2026, 5, 2)
        )

    mock_fetch.assert_called_once_with("USD", "EUR", date(2026, 5, 2))
    assert result == Decimal("92.00")


@pytest.mark.asyncio
async def test_convert_uses_cached_rate(db):
    target_date = date(2026, 5, 3)

    with patch(
        "app.services.currency_service._fetch_rate",
        new_callable=AsyncMock,
        return_value=Decimal("0.85"),
    ) as mock_fetch:
        # Primera llamada — popula caché
        await currency_service.convert(db, Decimal("1"), "GBP", "EUR", target_date)
        # Segunda llamada — debe usar caché
        result, _ = await currency_service.convert(
            db, Decimal("200.00"), "GBP", "EUR", target_date
        )

    # _fetch_rate solo se llama UNA vez
    assert mock_fetch.call_count == 1
    assert result == Decimal("170.00")


@pytest.mark.asyncio
async def test_convert_external_api_failure_returns_503(db):
    with patch(
        "app.services.currency_service._fetch_rate",
        new_callable=AsyncMock,
        side_effect=Exception("network error"),
    ):
        with pytest.raises(Exception) as exc_info:
            await currency_service.convert(
                db, Decimal("50.00"), "ARS", "EUR", date(2026, 5, 4)
            )
    # El servicio debe envolver el error en HTTPException 503
    assert exc_info.value.status_code == 503
