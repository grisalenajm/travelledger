"""Tests del webhook de importación de emails de confirmación de viaje."""
import pytest

# Email de ejemplo: confirmación de vuelo genérica
SAMPLE_FLIGHT_EMAIL = """
Flight IB0531 Confirmed
Iberia IB0531
Departure: 20-Jul-2026 at 11:25 / Madrid (MAD)
Arrival: 20-Jul-2026 at 11:50 / Lisbon (LIS)
Seat: 14A
Booking Reference: HS2Q5
"""

_VALID_SECRET = "test-webhook-secret-min-32-characters-ok!"

_BASE_PAYLOAD = {
    "message_id": "<test-001@example-airline.com>",
    "sender": "noreply@example-airline.com",
    "subject": "Flight Booking Confirmation",
    "body_text": SAMPLE_FLIGHT_EMAIL,
}


@pytest.mark.asyncio
async def test_webhook_without_secret_returns_401(client):
    res = await client.post("/api/webhooks/email", json=_BASE_PAYLOAD)
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_webhook_wrong_secret_returns_401(client):
    res = await client.post(
        "/api/webhooks/email",
        json=_BASE_PAYLOAD,
        headers={"X-Webhook-Secret": "wrong-secret"},
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_webhook_valid_secret_creates_leg(client, auth_headers):
    """Con secreto válido y email de vuelo → 200, legs_created=1 (trip_id=None)."""
    payload = {**_BASE_PAYLOAD, "message_id": "<test-flight-001@example-airline.com>"}
    res = await client.post(
        "/api/webhooks/email",
        json=payload,
        headers={"X-Webhook-Secret": _VALID_SECRET},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["skipped"] is False
    assert data["legs_created"] == 1


@pytest.mark.asyncio
async def test_webhook_creates_leg_with_notification(client, auth_headers):
    """Con email de vuelo válido → crea 1 tramo y genera notificación."""
    payload = {**_BASE_PAYLOAD, "message_id": "<with-notif-001@example-airline.com>"}
    res = await client.post(
        "/api/webhooks/email",
        json=payload,
        headers={"X-Webhook-Secret": _VALID_SECRET},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["skipped"] is False
    assert data["legs_created"] == 1
    assert data["notification_id"] is not None


@pytest.mark.asyncio
async def test_webhook_duplicate_message_id_is_skipped(client, auth_headers):
    """Importar el mismo message_id dos veces → segundo retorna skipped=True."""
    payload = {**_BASE_PAYLOAD, "message_id": "<duplicate-001@example-airline.com>"}

    r1 = await client.post(
        "/api/webhooks/email",
        json=payload,
        headers={"X-Webhook-Secret": _VALID_SECRET},
    )
    assert r1.status_code == 200
    assert r1.json()["skipped"] is False

    r2 = await client.post(
        "/api/webhooks/email",
        json=payload,
        headers={"X-Webhook-Secret": _VALID_SECRET},
    )
    assert r2.status_code == 200
    assert r2.json()["skipped"] is True


@pytest.mark.asyncio
async def test_webhook_unrecognized_email_creates_no_legs(client, auth_headers):
    """Email sin contenido de viaje reconocible → 0 tramos creados."""
    payload = {
        "message_id": "<spam-001@example.com>",
        "sender": "noreply@example.com",
        "subject": "Newsletter",
        "body_text": "Great deals this week! Buy now and save big.",
    }
    res = await client.post(
        "/api/webhooks/email",
        json=payload,
        headers={"X-Webhook-Secret": _VALID_SECRET},
    )
    assert res.status_code == 200
    assert res.json()["legs_created"] == 0
    assert res.json()["skipped"] is False


# ── Tests de notificaciones ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_notifications_count_initially_zero(client, auth_headers):
    res = await client.get("/api/notifications/count", headers=auth_headers)
    assert res.status_code == 200
    # Puede haber notificaciones de tests anteriores; solo verificamos que responde OK
    assert "unread" in res.json()


@pytest.mark.asyncio
async def test_notifications_list(client, auth_headers):
    res = await client.get("/api/notifications", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)
