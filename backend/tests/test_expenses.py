from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest

TRIP_PAYLOAD = {
    "name": "Expense Test Trip",
    "destination": "Tokyo",
    "start_date": "2026-06-01",
    "end_date": "2026-06-10",
    "primary_currency": "JPY",
    "budget": "500.00",
    "budget_currency": "EUR",
}


async def _create_trip(client, headers, payload=None):
    res = await client.post("/api/trips/", json=payload or TRIP_PAYLOAD, headers=headers)
    assert res.status_code == 201
    return res.json()["id"]


@pytest.mark.asyncio
async def test_create_expense_billable_defaults_to_true(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers)
    res = await client.post(
        "/api/expenses/",
        json={
            "trip_id": trip_id,
            "amount": "30.00",
            "currency": "EUR",
            "category": "Dining",
            "date": "2026-06-02",
            # billable NOT sent
        },
        headers=auth_headers,
    )
    assert res.status_code == 201
    assert res.json()["billable"] is True


@pytest.mark.asyncio
async def test_create_expense_converts_currency(client, auth_headers_chf):
    """Usuario con currency_base=CHF crea gasto en EUR — amount_base debe diferir."""
    trip_id = await _create_trip(
        client,
        auth_headers_chf,
        {**TRIP_PAYLOAD, "primary_currency": "EUR"},
    )

    with patch(
        "app.services.currency_service._fetch_rate",
        new_callable=AsyncMock,
        return_value=Decimal("0.95"),  # 1 EUR = 0.95 CHF
    ):
        res = await client.post(
            "/api/expenses/",
            json={
                "trip_id": trip_id,
                "amount": "100.00",
                "currency": "EUR",
                "category": "Lodging",
                "date": "2026-06-03",
            },
            headers=auth_headers_chf,
        )
    assert res.status_code == 201
    data = res.json()
    assert float(data["amount"]) == 100.0
    assert float(data["amount_base"]) == pytest.approx(95.0)


@pytest.mark.asyncio
async def test_create_expense_same_currency_no_external_call(client, auth_headers):
    """Cuando from_currency == user.currency_base (EUR) no se llama a la API externa."""
    trip_id = await _create_trip(client, auth_headers)

    with patch(
        "app.services.currency_service._fetch_rate",
        new_callable=AsyncMock,
    ) as mock_fetch:
        res = await client.post(
            "/api/expenses/",
            json={
                "trip_id": trip_id,
                "amount": "50.00",
                "currency": "EUR",  # == currency_base del usuario (EUR)
                "category": "Shopping",
                "date": "2026-06-04",
            },
            headers=auth_headers,
        )
    assert res.status_code == 201
    mock_fetch.assert_not_called()
    data = res.json()
    assert float(data["amount_base"]) == pytest.approx(50.0)


@pytest.mark.asyncio
async def test_update_expense_recalculates_amount_base(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers)

    create_res = await client.post(
        "/api/expenses/",
        json={
            "trip_id": trip_id,
            "amount": "100.00",
            "currency": "EUR",
            "category": "Culture",
            "date": "2026-06-05",
        },
        headers=auth_headers,
    )
    expense_id = create_res.json()["id"]
    original_base = create_res.json()["amount_base"]

    update_res = await client.put(
        f"/api/expenses/{expense_id}",
        json={"amount": "200.00"},
        headers=auth_headers,
    )
    assert update_res.status_code == 200
    assert float(update_res.json()["amount_base"]) != float(original_base)
    assert float(update_res.json()["amount_base"]) == pytest.approx(200.0)


@pytest.mark.asyncio
async def test_expenses_filtered_by_trip_id(client, auth_headers):
    trip_a = await _create_trip(client, auth_headers)
    trip_b = await _create_trip(
        client,
        auth_headers,
        {**TRIP_PAYLOAD, "name": "Trip B", "primary_currency": "EUR"},
    )

    for trip_id in [trip_a, trip_b]:
        await client.post(
            "/api/expenses/",
            json={
                "trip_id": trip_id,
                "amount": "10.00",
                "currency": "EUR",
                "category": "Other",
                "date": "2026-06-06",
            },
            headers=auth_headers,
        )

    res = await client.get(f"/api/expenses/?trip_id={trip_a}", headers=auth_headers)
    assert res.status_code == 200
    expenses = res.json()
    assert len(expenses) == 1
    assert expenses[0]["trip_id"] == trip_a
