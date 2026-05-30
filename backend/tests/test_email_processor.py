"""Tests del email_processor: adjuntos de imagen → Expense is_draft=True."""
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models.expense import Expense
from app.models.notification import Notification
from app.models.trip import Trip
from app.models.trip_leg import TripLeg
from app.models.user import User
from app.services.email_processor import _process_raw_email
from app.services.imap_service import RawEmail
from app.services.ocr_providers.base import OcrResult

# Imagen JPEG mínima válida (>1024 bytes) para pasar el filtro de tamaño
_JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"\x00" * 1200


def _make_ocr_result(amount: float = 45.00, currency: str = "EUR") -> OcrResult:
    return OcrResult(
        date=date(2026, 6, 10),
        amount=Decimal(str(amount)),
        currency=currency,
        category="Dining",
        description="Restaurante Central",
        confidence=0.88,
        raw_text='{"amount":45.00,"currency":"EUR"}',
    )


def _make_raw_email(image_attachments=None, body_text: str = "") -> RawEmail:
    return RawEmail(
        message_id=f"<test-{uuid4()}@ledger.test>",
        sender="test@example.com",
        subject="Ticket adjunto",
        body_text=body_text,
        image_attachments=image_attachments or [],
    )


async def _seed_user(db) -> User:
    user = User(
        id=uuid4(),
        email=f"emailproc-{uuid4().hex[:6]}@ledger.test",
        name="Email Proc Test",
        password_hash="$2b$12$irrelevant",
        currency_base="EUR",
        is_admin=False,
    )
    db.add(user)
    await db.flush()
    return user


async def _seed_active_trip(db, user_id) -> Trip:
    today = date.today()
    trip = Trip(
        id=uuid4(),
        user_id=user_id,
        name="Viaje Test",
        destination="Madrid",
        start_date=today - timedelta(days=2),
        end_date=today + timedelta(days=5),
        primary_currency="EUR",
        budget=Decimal("1000"),
        budget_currency="EUR",
        status="active",
    )
    db.add(trip)
    await db.flush()
    return trip


def _make_aiofiles_open_mock():
    """Crea un mock compatible con `async with aiofiles.open(...) as f`."""
    mock_file = AsyncMock()
    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=mock_file)
    ctx.__aexit__ = AsyncMock(return_value=False)
    return MagicMock(return_value=ctx)


@pytest.mark.asyncio
async def test_email_with_image_attachment_creates_draft_expense(db):
    """Email con JPEG adjunto crea un Expense is_draft=True en el viaje activo."""
    user = await _seed_user(db)
    trip = await _seed_active_trip(db, user.id)

    raw = _make_raw_email(image_attachments=[("image/jpeg", _JPEG_BYTES)])

    mock_provider = MagicMock()
    mock_provider.extract = AsyncMock(return_value=_make_ocr_result())

    with (
        patch("app.services.ocr_factory.get_ocr_provider", new_callable=AsyncMock, return_value=mock_provider),
        patch("app.services.currency_service.convert", new_callable=AsyncMock, return_value=(Decimal("45.00"), date(2026, 6, 10))),
        patch("app.services.expense_service.geocode_expense_bg", new_callable=AsyncMock),
        patch("aiofiles.open", new=_make_aiofiles_open_mock()),
        patch("aiofiles.os.makedirs", new_callable=AsyncMock),
    ):
        result = await _process_raw_email(db, raw, user)

    assert result["expenses"] == 1
    assert result["legs"] == 0

    expenses = (await db.execute(select(Expense).where(Expense.user_id == user.id))).scalars().all()
    assert len(expenses) == 1
    exp = expenses[0]
    assert exp.is_draft is True
    assert exp.trip_id == trip.id
    assert exp.source == "email_receipt"
    assert exp.billable is True
    assert exp.category == "Dining"
    assert exp.currency == "EUR"


@pytest.mark.asyncio
async def test_email_with_image_no_active_trip_skips_expense(db):
    """Email con adjunto pero sin viaje activo → no crea Expense, sí notificación."""
    user = await _seed_user(db)
    # No se crea ningún trip

    raw = _make_raw_email(image_attachments=[("image/jpeg", _JPEG_BYTES)])

    mock_provider = MagicMock()
    mock_provider.extract = AsyncMock(return_value=_make_ocr_result())

    with patch("app.services.ocr_factory.get_ocr_provider", new_callable=AsyncMock, return_value=mock_provider):
        result = await _process_raw_email(db, raw, user)

    assert result["expenses"] == 0

    # OCR nunca se invocó — se salió antes por falta de viaje activo
    mock_provider.extract.assert_not_called()

    # Notificación creada (puede decir "no se encontraron..." ya que no hay legs ni expenses)
    notifs = (await db.execute(select(Notification).where(Notification.user_id == user.id))).scalars().all()
    assert len(notifs) == 1


@pytest.mark.asyncio
async def test_email_with_image_and_flight_body_creates_both(db):
    """Email con texto de vuelo + JPEG → crea TripLeg Y Expense."""
    user = await _seed_user(db)
    await _seed_active_trip(db, user.id)

    flight_body = (
        "Your booking is confirmed.\n"
        "Flight: IB6827\nFrom: MAD To: BCN\n"
        "Departure: 15/06/2026 20:30\nArrival: 15/06/2026 21:45\n"
        "Booking Reference: ABC123\n"
    )
    raw = RawEmail(
        message_id=f"<combo-{uuid4()}@ledger.test>",
        sender="airline@example.com",
        subject="Tu vuelo + ticket restaurante",
        body_text=flight_body,
        image_attachments=[("image/jpeg", _JPEG_BYTES)],
    )

    mock_provider = MagicMock()
    mock_provider.extract = AsyncMock(return_value=_make_ocr_result())

    with (
        patch("app.services.ocr_factory.get_ocr_provider", new_callable=AsyncMock, return_value=mock_provider),
        patch("app.services.currency_service.convert", new_callable=AsyncMock, return_value=(Decimal("45.00"), date(2026, 6, 10))),
        patch("app.services.expense_service.geocode_expense_bg", new_callable=AsyncMock),
        patch("aiofiles.open", new=_make_aiofiles_open_mock()),
        patch("aiofiles.os.makedirs", new_callable=AsyncMock),
    ):
        result = await _process_raw_email(db, raw, user)

    assert result["legs"] == 1
    assert result["expenses"] == 1

    legs = (await db.execute(select(TripLeg).where(TripLeg.user_id == user.id))).scalars().all()
    assert len(legs) == 1

    expenses = (await db.execute(select(Expense).where(Expense.user_id == user.id))).scalars().all()
    assert len(expenses) == 1
    assert expenses[0].is_draft is True
    assert expenses[0].source == "email_receipt"


@pytest.mark.asyncio
async def test_email_with_multiple_images_creates_multiple_expenses(db):
    """Email con 3 JPEG adjuntos → 3 Expenses is_draft=True."""
    user = await _seed_user(db)
    await _seed_active_trip(db, user.id)

    attachments = [("image/jpeg", _JPEG_BYTES) for _ in range(3)]
    raw = _make_raw_email(image_attachments=attachments)

    mock_provider = MagicMock()
    mock_provider.extract = AsyncMock(return_value=_make_ocr_result(amount=20.00))

    with (
        patch("app.services.ocr_factory.get_ocr_provider", new_callable=AsyncMock, return_value=mock_provider),
        patch("app.services.currency_service.convert", new_callable=AsyncMock, return_value=(Decimal("20.00"), date(2026, 6, 10))),
        patch("app.services.expense_service.geocode_expense_bg", new_callable=AsyncMock),
        patch("aiofiles.open", new=_make_aiofiles_open_mock()),
        patch("aiofiles.os.makedirs", new_callable=AsyncMock),
    ):
        result = await _process_raw_email(db, raw, user)

    assert result["expenses"] == 3
    assert mock_provider.extract.call_count == 3

    expenses = (await db.execute(select(Expense).where(Expense.user_id == user.id))).scalars().all()
    assert len(expenses) == 3
    assert all(e.is_draft is True for e in expenses)
    assert all(e.source == "email_receipt" for e in expenses)
    assert all(e.billable is True for e in expenses)
