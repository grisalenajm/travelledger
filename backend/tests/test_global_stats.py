import pytest

TRIP_PAYLOAD = {
    "name": "Global Stats Trip",
    "destination": "Madrid",
    "start_date": "2026-03-01",
    "end_date": "2026-03-05",
    "primary_currency": "EUR",
    "budget": "2000.00",
    "budget_currency": "EUR",
}

TRIP_2025 = {
    "name": "Past Trip",
    "destination": "Paris",
    "start_date": "2025-06-01",
    "end_date": "2025-06-05",
    "primary_currency": "EUR",
    "budget": "500.00",
    "budget_currency": "EUR",
}


async def _create_trip(client, auth_headers, payload=None) -> str:
    res = await client.post("/api/trips", json=payload or TRIP_PAYLOAD, headers=auth_headers)
    assert res.status_code == 201
    return res.json()["id"]


async def _add_expense(client, auth_headers, trip_id: str, **kwargs):
    defaults = {
        "trip_id": trip_id,
        "amount": "100.00",
        "currency": "EUR",
        "category": "Dining",
        "date": "2026-03-02",
        "billable": True,
    }
    defaults.update(kwargs)
    res = await client.post("/api/expenses", data=defaults, headers=auth_headers)
    assert res.status_code == 201
    return res.json()


@pytest.mark.asyncio
async def test_global_stats_empty(client, auth_headers):
    res = await client.get("/api/stats/global?period=year&year=2026", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["expense_count"] == 0
    assert data["total_base"] == 0.0
    assert data["trip_count"] == 0
    assert data["by_category"] == []
    assert data["by_month"] == []
    assert data["by_trip"] == []


@pytest.mark.asyncio
async def test_global_stats_structure(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers)
    await _add_expense(client, auth_headers, trip_id, category="Transport", amount="200.00")
    await _add_expense(client, auth_headers, trip_id, category="Dining", amount="50.00")

    res = await client.get("/api/stats/global?period=year&year=2026", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["expense_count"] == 2
    assert data["trip_count"] == 1
    assert data["total_base"] > 0
    assert len(data["by_category"]) == 2
    assert len(data["by_month"]) >= 1
    assert len(data["by_trip"]) == 1
    assert data["by_trip"][0]["trip_name"] == "Global Stats Trip"


@pytest.mark.asyncio
async def test_global_stats_year_filter(client, auth_headers):
    trip_2025_id = await _create_trip(client, auth_headers, TRIP_2025)
    await _add_expense(client, auth_headers, trip_2025_id, date="2025-06-02")

    trip_2026_id = await _create_trip(client, auth_headers)
    await _add_expense(client, auth_headers, trip_2026_id, date="2026-03-02")

    res_2026 = await client.get("/api/stats/global?period=year&year=2026", headers=auth_headers)
    assert res_2026.status_code == 200
    data_2026 = res_2026.json()

    res_2025 = await client.get("/api/stats/global?period=year&year=2025", headers=auth_headers)
    assert res_2025.status_code == 200
    data_2025 = res_2025.json()

    # Each year returns only its own expenses
    for entry in data_2026["by_month"]:
        assert entry["month"].startswith("2026")
    for entry in data_2025["by_month"]:
        assert entry["month"].startswith("2025")


@pytest.mark.asyncio
async def test_global_stats_requires_auth(client):
    res = await client.get("/api/stats/global?period=year&year=2026")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_flight_stats_empty(client, auth_headers):
    res = await client.get("/api/stats/flights?period=year&year=2026", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_flights"] == 0
    assert data["total_km"] == 0.0
    assert data["by_carrier"] == []
    assert data["top_routes"] == []


@pytest.mark.asyncio
async def test_flight_stats_structure(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers)

    leg_payload = {
        "mode": "flight",
        "origin": "MAD",
        "destination": "BCN",
        "carrier": "Iberia",
        "origin_lat": "40.4719",
        "origin_lng": "-3.5626",
        "destination_lat": "41.2971",
        "destination_lng": "2.0785",
    }
    res = await client.post(f"/api/trips/{trip_id}/legs", json=leg_payload, headers=auth_headers)
    assert res.status_code == 201

    res = await client.get("/api/stats/flights?period=year&year=2026", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_flights"] == 1
    assert data["total_km"] > 0
    assert len(data["by_carrier"]) == 1
    assert data["by_carrier"][0]["carrier"] == "Iberia"
    assert len(data["top_routes"]) == 1
    assert "MAD" in data["top_routes"][0]["route"]
    assert "BCN" in data["top_routes"][0]["route"]


@pytest.mark.asyncio
async def test_flight_stats_requires_auth(client):
    res = await client.get("/api/stats/flights?period=year&year=2026")
    assert res.status_code == 401
