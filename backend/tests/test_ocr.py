from decimal import Decimal
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.ocr_service import OcrExtracted

# Minimal valid JPEG magic bytes (3-byte prefix + padding to satisfy _detect_mime)
_JPEG_BYTES = b"\xff\xd8\xff" + b"\x00" * 20
_PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 10
_GIF_BYTES = b"GIF89a" + b"\x00" * 20  # invalid MIME


TRIP_PAYLOAD = {
    "name": "OCR Test Trip",
    "destination": "Paris",
    "start_date": "2026-06-01",
    "end_date": "2026-06-10",
    "primary_currency": "EUR",
    "budget": "1000.00",
    "budget_currency": "EUR",
}


async def _create_trip(client, headers):
    res = await client.post("/api/trips/", json=TRIP_PAYLOAD, headers=headers)
    assert res.status_code == 201
    return res.json()["id"]


def _make_ocr_success(amount=84.50, currency="EUR") -> OcrExtracted:
    from datetime import date
    return OcrExtracted(
        date=date(2026, 6, 3),
        amount=Decimal(str(amount)),
        currency=currency,
        category="Dining",
        description="Le Bistrot Paris",
        confidence=0.92,
        raw_text='{"date":"2026-06-03","amount":84.50,"currency":"EUR","category":"Dining","description":"Le Bistrot Paris","confidence":0.92}',
    )


def _make_ocr_empty() -> OcrExtracted:
    return OcrExtracted(
        date=None, amount=None, currency=None, category=None,
        description=None, confidence=0.0, raw_text=None
    )


@pytest.mark.asyncio
async def test_upload_receipt_success(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers)

    with (
        patch("app.routers.receipts.ocr_service.extract", new_callable=AsyncMock, return_value=_make_ocr_success()),
        patch("app.routers.receipts.paperless_service.upload_document", new_callable=AsyncMock, return_value=42),
        patch("app.services.currency_service._fetch_rate", new_callable=AsyncMock, return_value=Decimal("1.0")),
    ):
        res = await client.post(
            "/api/receipts/upload",
            files={"file": ("receipt.jpg", BytesIO(_JPEG_BYTES), "image/jpeg")},
            data={"trip_id": trip_id},
            headers=auth_headers,
        )

    assert res.status_code == 201
    data = res.json()
    assert data["is_draft"] is True
    assert data["category"] == "Dining"
    assert data["description"] == "Le Bistrot Paris"
    assert data["paperless_doc_id"] == 42
    assert float(data["ocr_confidence"]) == pytest.approx(0.92)


@pytest.mark.asyncio
async def test_upload_receipt_haiku_fails(client, auth_headers):
    """When Haiku returns confidence=0 / empty fields, expense is still created."""
    trip_id = await _create_trip(client, auth_headers)

    with (
        patch("app.routers.receipts.ocr_service.extract", new_callable=AsyncMock, return_value=_make_ocr_empty()),
        patch("app.routers.receipts.paperless_service.upload_document", new_callable=AsyncMock, return_value=99),
    ):
        res = await client.post(
            "/api/receipts/upload",
            files={"file": ("receipt.png", BytesIO(_PNG_BYTES), "image/png")},
            data={"trip_id": trip_id},
            headers=auth_headers,
        )

    assert res.status_code == 201
    data = res.json()
    assert data["is_draft"] is True
    assert float(data["amount"]) == pytest.approx(0.0)
    assert float(data["ocr_confidence"]) == pytest.approx(0.0)
    assert data["category"] == "Other"
    assert data["currency"] == "EUR"  # falls back to trip.primary_currency


@pytest.mark.asyncio
async def test_upload_receipt_paperless_fails(client, auth_headers):
    """When Paperless upload raises, expense is still created with paperless_doc_id=None."""
    trip_id = await _create_trip(client, auth_headers)

    with (
        patch("app.routers.receipts.ocr_service.extract", new_callable=AsyncMock, return_value=_make_ocr_success()),
        patch(
            "app.routers.receipts.paperless_service.upload_document",
            new_callable=AsyncMock,
            side_effect=Exception("Paperless unreachable"),
        ),
        patch("app.services.currency_service._fetch_rate", new_callable=AsyncMock, return_value=Decimal("1.0")),
    ):
        res = await client.post(
            "/api/receipts/upload",
            files={"file": ("ticket.jpg", BytesIO(_JPEG_BYTES), "image/jpeg")},
            data={"trip_id": trip_id},
            headers=auth_headers,
        )

    assert res.status_code == 201
    data = res.json()
    assert data["is_draft"] is True
    assert data["paperless_doc_id"] is None


@pytest.mark.asyncio
async def test_upload_receipt_invalid_mime(client, auth_headers):
    """GIF is rejected with 422."""
    trip_id = await _create_trip(client, auth_headers)

    res = await client.post(
        "/api/receipts/upload",
        files={"file": ("anim.gif", BytesIO(_GIF_BYTES), "image/gif")},
        data={"trip_id": trip_id},
        headers=auth_headers,
    )

    assert res.status_code == 422
