import pytest

TRIP_PAYLOAD = {
    "name": "Test Paris",
    "destination": "Paris",
    "start_date": "2026-05-01",
    "end_date": "2026-05-07",
    "primary_currency": "EUR",
    "budget": "1000.00",
    "budget_currency": "EUR",
}


@pytest.mark.asyncio
async def test_create_trip_ok(client, auth_headers):
    res = await client.post("/api/trips/", json=TRIP_PAYLOAD, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Test Paris"
    assert data["primary_currency"] == "EUR"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_trip_missing_primary_currency_returns_422(client, auth_headers):
    payload = {k: v for k, v in TRIP_PAYLOAD.items() if k != "primary_currency"}
    res = await client.post("/api/trips/", json=payload, headers=auth_headers)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_get_trips_returns_only_own(client, auth_headers):
    # Crear trip con el usuario A
    await client.post("/api/trips/", json=TRIP_PAYLOAD, headers=auth_headers)

    # Crear usuario B y hacer login
    await client.post(
        "/api/auth/register",
        json={
            "email": "userb@ledger.dev",
            "name": "User B",
            "password": "TestPass1!secret",
            "currency_base": "EUR",
        },
    )
    res_b = await client.post(
        "/api/auth/login",
        json={"email": "userb@ledger.dev", "password": "TestPass1!secret"},
    )
    headers_b = {"Authorization": f"Bearer {res_b.json()['access_token']}"}

    trips_b = await client.get("/api/trips/", headers=headers_b)
    assert trips_b.status_code == 200
    # Usuario B no tiene trips propios
    assert trips_b.json() == []


@pytest.mark.asyncio
async def test_trip_summary_percentage_correct(client, auth_headers):
    trip_res = await client.post(
        "/api/trips/",
        json={**TRIP_PAYLOAD, "budget": "100.00", "budget_currency": "EUR"},
        headers=auth_headers,
    )
    trip_id = trip_res.json()["id"]

    # Gasto de 50 EUR (50% del presupuesto)
    await client.post(
        "/api/expenses/",
        json={
            "trip_id": trip_id,
            "amount": "50.00",
            "currency": "EUR",
            "category": "Dining",
            "date": "2026-05-02",
        },
        headers=auth_headers,
    )

    summary = await client.get(f"/api/trips/{trip_id}/summary", headers=auth_headers)
    assert summary.status_code == 200
    data = summary.json()
    assert float(data["spent_base"]) == pytest.approx(50.0)
    assert float(data["percentage"]) == pytest.approx(50.0)


@pytest.mark.asyncio
async def test_trip_summary_zero_budget_returns_zero_percentage(client, auth_headers):
    trip_res = await client.post(
        "/api/trips/",
        json={**TRIP_PAYLOAD, "budget": "0", "budget_currency": "EUR"},
        headers=auth_headers,
    )
    trip_id = trip_res.json()["id"]

    summary = await client.get(f"/api/trips/{trip_id}/summary", headers=auth_headers)
    assert summary.status_code == 200
    assert summary.json()["percentage"] == 0.0


@pytest.mark.asyncio
async def test_delete_trip_cascades_expenses(client, auth_headers):
    trip_res = await client.post("/api/trips/", json=TRIP_PAYLOAD, headers=auth_headers)
    trip_id = trip_res.json()["id"]

    await client.post(
        "/api/expenses/",
        json={
            "trip_id": trip_id,
            "amount": "25.00",
            "currency": "EUR",
            "category": "Transport",
            "date": "2026-05-03",
        },
        headers=auth_headers,
    )

    # Borrar el trip
    del_res = await client.delete(f"/api/trips/{trip_id}", headers=auth_headers)
    assert del_res.status_code == 204

    # Los gastos del trip ya no existen
    expenses = await client.get(
        f"/api/expenses/?trip_id={trip_id}", headers=auth_headers
    )
    assert expenses.json() == []
