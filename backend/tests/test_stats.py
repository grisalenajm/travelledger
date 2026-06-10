import pytest

TRIP_PAYLOAD = {
    "name": "Stats Test Trip",
    "destination": "Barcelona",
    "start_date": "2026-06-01",
    "end_date": "2026-06-05",
    "primary_currency": "EUR",
    "budget": "1000.00",
    "budget_currency": "EUR",
}


async def _create_trip(client, auth_headers) -> str:
    res = await client.post("/api/trips", json=TRIP_PAYLOAD, headers=auth_headers)
    assert res.status_code == 201
    return res.json()["id"]


async def _add_expense(client, auth_headers, trip_id: str, **kwargs):
    defaults = {
        "trip_id": trip_id,
        "amount": "50.00",
        "currency": "EUR",
        "category": "Dining",
        "date": "2026-06-02",
        "billable": True,
    }
    defaults.update(kwargs)
    from httpx import AsyncClient
    res = await client.post(
        "/api/expenses",
        data=defaults,
        headers=auth_headers,
    )
    assert res.status_code == 201
    return res.json()


@pytest.mark.asyncio
async def test_stats_empty_trip(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers)
    res = await client.get(f"/api/trips/{trip_id}/stats", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["expense_count"] == 0
    assert data["total_base"] == 0.0
    assert data["by_category"] == []
    assert data["by_day"] == []
    assert data["by_payment"] == []
    assert data["top_merchants"] == []


@pytest.mark.asyncio
async def test_stats_structure(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers)
    res = await client.get(f"/api/trips/{trip_id}/stats", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "trip_id" in data
    assert "currency_base" in data
    assert "total_base" in data
    assert "expense_count" in data
    assert "duration_days" in data
    assert "avg_per_day" in data
    assert "budget_base" in data
    assert "budget_pct" in data
    assert data["duration_days"] == 5
    assert data["budget_base"] == 1000.0


@pytest.mark.asyncio
async def test_stats_not_found(client, auth_headers):
    import uuid
    fake_id = str(uuid.uuid4())
    res = await client.get(f"/api/trips/{fake_id}/stats", headers=auth_headers)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_stats_other_user_forbidden(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers)

    await client.post(
        "/api/auth/register",
        json={
            "email": "other@ledger.dev",
            "name": "Other",
            "password": "TestPass1!secret",
            "currency_base": "EUR",
        },
    )
    login = await client.post(
        "/api/auth/login",
        json={"email": "other@ledger.dev", "password": "TestPass1!secret"},
    )
    other_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    res = await client.get(f"/api/trips/{trip_id}/stats", headers=other_headers)
    assert res.status_code == 404
