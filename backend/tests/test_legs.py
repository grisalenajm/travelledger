import pytest

TRIP_PAYLOAD = {
    "name": "Test Trip Legs",
    "destination": "Madrid",
    "start_date": "2026-06-01",
    "end_date": "2026-06-10",
    "primary_currency": "EUR",
    "budget": "2000.00",
    "budget_currency": "EUR",
}

FLIGHT_LEG = {
    "mode": "flight",
    "origin": "MAD",
    "destination": "BCN",
    "departure_local": "2026-06-02T10:00:00",
    "arrival_local": "2026-06-02T11:15:00",
    "carrier": "Iberia",
    "flight_number": "IB1234",
    # Adolfo Suárez Madrid-Barajas → El Prat approx coords
    "origin_lat": "40.4983",
    "origin_lng": "-3.5676",
    "destination_lat": "41.2974",
    "destination_lng": "2.0833",
}

ACCOMMODATION_LEG = {
    "mode": "accommodation",
    "accommodation_name": "Hotel Arts",
    "accommodation_address": "Carrer de la Marina 19, Barcelona",
    "check_in": "2026-06-02T14:00:00",
    "check_out": "2026-06-05T12:00:00",
    "accommodation_provider": "Marriott",
}

CAR_RENTAL_LEG = {
    "mode": "car_rental",
    "rental_company": "Hertz",
    "pickup_location": "Aeropuerto de Madrid",
    "dropoff_location": "Aeropuerto de Madrid",
    "pickup_datetime": "2026-06-05T10:00:00",
    "dropoff_datetime": "2026-06-07T10:00:00",
    "confirmation_number": "HZ-12345",
}


async def _create_trip(client, auth_headers) -> str:
    res = await client.post("/api/trips", json=TRIP_PAYLOAD, headers=auth_headers)
    assert res.status_code == 201
    return res.json()["id"]


@pytest.mark.asyncio
async def test_create_flight_leg(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers)
    res = await client.post(f"/api/trips/{trip_id}/legs", json=FLIGHT_LEG, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["mode"] == "flight"
    assert data["carrier"] == "Iberia"
    assert data["flight_number"] == "IB1234"
    assert data["has_document"] is False


@pytest.mark.asyncio
async def test_flight_haversine_distance_computed(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers)
    res = await client.post(f"/api/trips/{trip_id}/legs", json=FLIGHT_LEG, headers=auth_headers)
    assert res.status_code == 201
    distance = float(res.json()["distance_km"])
    # MAD → BCN ≈ 480–510 km
    assert 400 < distance < 600


@pytest.mark.asyncio
async def test_accommodation_leg_no_distance(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers)
    res = await client.post(
        f"/api/trips/{trip_id}/legs", json=ACCOMMODATION_LEG, headers=auth_headers
    )
    assert res.status_code == 201
    data = res.json()
    assert data["mode"] == "accommodation"
    assert data["accommodation_name"] == "Hotel Arts"
    assert data["distance_km"] is None


@pytest.mark.asyncio
async def test_car_rental_leg(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers)
    res = await client.post(
        f"/api/trips/{trip_id}/legs", json=CAR_RENTAL_LEG, headers=auth_headers
    )
    assert res.status_code == 201
    data = res.json()
    assert data["mode"] == "car_rental"
    assert data["rental_company"] == "Hertz"
    assert data["confirmation_number"] == "HZ-12345"


@pytest.mark.asyncio
async def test_list_legs_chronological_order(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers)
    # Accommodation check_in 14:00, flight departure 10:00 → flight first
    await client.post(f"/api/trips/{trip_id}/legs", json=ACCOMMODATION_LEG, headers=auth_headers)
    await client.post(f"/api/trips/{trip_id}/legs", json=FLIGHT_LEG, headers=auth_headers)
    res = await client.get(f"/api/trips/{trip_id}/legs", headers=auth_headers)
    assert res.status_code == 200
    legs = res.json()
    assert len(legs) == 2
    assert legs[0]["mode"] == "flight"
    assert legs[1]["mode"] == "accommodation"


@pytest.mark.asyncio
async def test_update_leg(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers)
    create_res = await client.post(
        f"/api/trips/{trip_id}/legs", json=ACCOMMODATION_LEG, headers=auth_headers
    )
    leg_id = create_res.json()["id"]
    update_res = await client.put(
        f"/api/trips/{trip_id}/legs/{leg_id}",
        json={"accommodation_name": "Hotel W"},
        headers=auth_headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["accommodation_name"] == "Hotel W"


@pytest.mark.asyncio
async def test_delete_leg(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers)
    create_res = await client.post(
        f"/api/trips/{trip_id}/legs", json=FLIGHT_LEG, headers=auth_headers
    )
    leg_id = create_res.json()["id"]
    del_res = await client.delete(f"/api/trips/{trip_id}/legs/{leg_id}", headers=auth_headers)
    assert del_res.status_code == 204
    list_res = await client.get(f"/api/trips/{trip_id}/legs", headers=auth_headers)
    assert list_res.json() == []


@pytest.mark.asyncio
async def test_leg_requires_trip_ownership(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers)
    await client.post(
        "/api/auth/register",
        json={
            "email": "other@ledger.dev",
            "name": "Other User",
            "password": "TestPass1!secret",
            "currency_base": "EUR",
        },
    )
    res_b = await client.post(
        "/api/auth/login",
        json={"email": "other@ledger.dev", "password": "TestPass1!secret"},
    )
    headers_b = {"Authorization": f"Bearer {res_b.json()['access_token']}"}
    res = await client.post(f"/api/trips/{trip_id}/legs", json=FLIGHT_LEG, headers=headers_b)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_create_without_coords_resolves_iata_and_distance(client, auth_headers):
    """Sin coords explícitas, los códigos IATA (MAD/BCN) se resuelven en el
    momento de crear el leg (airport_service) y la distancia se calcula."""
    trip_id = await _create_trip(client, auth_headers)
    leg_without_coords = {**FLIGHT_LEG}
    for k in ("origin_lat", "origin_lng", "destination_lat", "destination_lng"):
        leg_without_coords.pop(k)
    create_res = await client.post(
        f"/api/trips/{trip_id}/legs", json=leg_without_coords, headers=auth_headers
    )
    data = create_res.json()
    assert data["origin_lat"] is not None
    assert data["distance_km"] is not None
    assert float(data["distance_km"]) > 400  # MAD→BCN ≈ 483 km


@pytest.mark.asyncio
async def test_update_distance_recalculated_when_coords_change(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers)
    create_res = await client.post(
        f"/api/trips/{trip_id}/legs", json=FLIGHT_LEG, headers=auth_headers
    )
    leg_id = create_res.json()["id"]

    update_res = await client.put(
        f"/api/trips/{trip_id}/legs/{leg_id}",
        json={
            "origin_lat": "40.4983",
            "origin_lng": "-3.5676",
            "destination_lat": "41.2974",
            "destination_lng": "2.0833",
        },
        headers=auth_headers,
    )
    assert update_res.status_code == 200
    assert float(update_res.json()["distance_km"]) > 400
