"""Orquestador: IMAP → travel_email_parser → pending TripLegs + notificaciones."""
import asyncio
import logging
from datetime import date as date_t
from decimal import Decimal
from uuid import UUID, uuid4

import aiofiles
import aiofiles.os
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.email_import import EmailImport
from app.models.expense import Expense
from app.models.notification import Notification
from app.models.trip import Trip
from app.models.trip_leg import TripLeg
from app.models.user import User
from app.services.travel_email_parser import TravelParseResult, parse_travel_email_text
from app.services.imap_service import RawEmail, fetch_unseen_emails

logger = logging.getLogger(__name__)


async def _resolve_user(db: AsyncSession) -> User | None:
    if settings.WEBHOOK_USER_EMAIL:
        result = await db.execute(
            select(User).where(User.email == settings.WEBHOOK_USER_EMAIL)
        )
        user = result.scalar_one_or_none()
        if user:
            return user
    result = await db.execute(
        select(User).where(User.is_admin.is_(True)).limit(1)
    )
    return result.scalar_one_or_none()


async def _get_imap_config(db: AsyncSession, user_id: UUID) -> dict:
    """Lee config IMAP de user_settings, fallback a env vars."""
    from app.services.settings_service import get as get_setting

    host = await get_setting(db, user_id, "mail_host") or settings.IMAP_HOST
    port_raw = await get_setting(db, user_id, "mail_imap_port")
    port = int(port_raw) if port_raw else settings.IMAP_PORT
    user = await get_setting(db, user_id, "mail_user") or settings.IMAP_USER
    password = await get_setting(db, user_id, "mail_password") or settings.IMAP_PASSWORD
    folder = await get_setting(db, user_id, "mail_imap_folder") or settings.IMAP_FOLDER
    sender_filter = await get_setting(db, user_id, "mail_sender_filter") or settings.IMAP_SENDER_FILTER
    enabled_str = await get_setting(db, user_id, "mail_enabled")
    enabled = enabled_str == "true"

    return {
        "host": host, "port": port, "user": user, "password": password,
        "folder": folder, "sender_filter": sender_filter, "enabled": enabled,
    }


_LEG_TYPE_TO_MODE = {
    "flight":     "flight",
    "hotel":      "accommodation",
    "car_rental": "car_rental",
    "train":      "train",
    "unknown":    "other",
}


def _leg_from_result(user_id: UUID, result: TravelParseResult) -> TripLeg:
    """Convierte TravelParseResult en TripLeg pendiente de asignación a viaje."""
    mode = _LEG_TYPE_TO_MODE.get(result.leg_type, "other")
    leg = TripLeg(
        trip_id=None,
        user_id=user_id,
        mode=mode,
        source="email_import",
        confirmed=False,
        notes=result.parser_notes,
    )
    if result.leg_type == "flight":
        leg.carrier = result.carrier
        leg.flight_number = result.flight_number
        leg.origin = result.origin
        leg.destination = result.destination
        leg.departure_local = result.departure_local
        leg.arrival_local = result.arrival_local
        leg.locator_code = result.locator_code
    elif result.leg_type == "hotel":
        leg.accommodation_name = result.accommodation_name
        leg.accommodation_address = result.accommodation_address
        leg.check_in = result.check_in
        leg.check_out = result.check_out
        leg.confirmation_number = result.confirmation_number
    elif result.leg_type == "car_rental":
        leg.rental_company = result.rental_company
        leg.pickup_location = result.pickup_location
        leg.dropoff_location = result.dropoff_location
        leg.pickup_datetime = result.pickup_datetime
        leg.dropoff_datetime = result.dropoff_datetime
        leg.confirmation_number = result.confirmation_number
    elif result.leg_type == "train":
        leg.carrier = result.carrier
        leg.flight_number = result.flight_number
        leg.origin = result.origin
        leg.destination = result.destination
        leg.departure_local = result.departure_local
        leg.arrival_local = result.arrival_local
        leg.locator_code = result.locator_code
    return leg


async def _get_active_trip_id(db: AsyncSession, user_id: UUID) -> UUID | None:
    """Devuelve el trip_id del viaje activo del usuario, o None si no hay ninguno."""
    today = date_t.today()
    result = await db.execute(
        select(Trip.id)
        .where(Trip.user_id == user_id)
        .where(Trip.status == "active")
        .where(Trip.start_date <= today)
        .where(Trip.end_date >= today)
        .order_by(Trip.start_date.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _create_expense_from_image(
    db: AsyncSession,
    image_bytes: bytes,
    mime_type: str,
    user: User,
    trip_id: UUID,
    email_subject: str | None,
) -> Expense | None:
    """Ejecuta OCR sobre una imagen y crea un Expense is_draft=True."""
    from app.services.ocr_factory import get_ocr_provider
    from app.services.ocr_providers.base import OcrProviderNotConfiguredError
    from app.services import currency_service
    from app.services.expense_service import extract_exif_gps, geocode_expense_bg, safe_coordinate

    try:
        provider = await get_ocr_provider(db, user.id)
    except OcrProviderNotConfiguredError:
        logger.warning("email_processor: OCR no configurado para user=%s", user.id)
        return None

    try:
        ocr = await provider.extract(image_bytes, mime_type)
    except Exception as exc:
        logger.error("email_processor: OCR failed: %s", exc)
        return None

    logger.info(
        "email_processor: OCR email adjunto — confidence=%.2f date=%s amount=%s",
        ocr.confidence, ocr.date, ocr.amount,
    )

    exif_coords = None
    if mime_type != "application/pdf":
        exif_coords = extract_exif_gps(image_bytes)

    expense_id = uuid4()
    expense_date = ocr.date or date_t.today()

    trip_obj = await db.get(Trip, trip_id)
    expense_currency = ocr.currency or (trip_obj.primary_currency if trip_obj else user.currency_base)
    expense_amount = ocr.amount if ocr.amount is not None else Decimal("0")

    if expense_amount > 0:
        amount_base, rate_date = await currency_service.convert(
            db, expense_amount, expense_currency, user.currency_base, expense_date
        )
    else:
        amount_base = Decimal("0")
        rate_date = expense_date

    ext = {
        "image/jpeg": ".jpg", "image/png": ".png",
        "image/webp": ".webp", "application/pdf": ".pdf",
    }.get(mime_type, ".jpg")
    dir_path = f"/app/uploads/{user.id}"
    await aiofiles.os.makedirs(dir_path, exist_ok=True)
    local_path = f"{dir_path}/{expense_id}{ext}"
    async with aiofiles.open(local_path, "wb") as f:
        await f.write(image_bytes)

    location_lat = None
    location_lng = None
    if exif_coords:
        location_lat = safe_coordinate(exif_coords[0])
        location_lng = safe_coordinate(exif_coords[1])

    expense = Expense(
        id=expense_id,
        trip_id=trip_id,
        user_id=user.id,
        date=expense_date,
        amount=expense_amount,
        currency=expense_currency,
        amount_base=amount_base,
        rate_date=rate_date,
        category=ocr.category or "Other",
        description=ocr.description,
        local_path=local_path,
        is_draft=True,
        ocr_raw=ocr.raw_text,
        ocr_confidence=ocr.confidence,
        billable=True,
        location_lat=location_lat,
        location_lng=location_lng,
        location_name=None,  # nunca asignar texto sin coords reales
        source="email_receipt",
    )
    db.add(expense)
    await db.flush()

    if location_lat is None and ocr.description:
        asyncio.create_task(geocode_expense_bg(expense.id, ocr.description))

    return expense


async def _process_raw_email(db: AsyncSession, raw: RawEmail, user: User) -> dict:
    """Procesa un email crudo. Devuelve {legs, expenses}."""
    existing = await db.execute(
        select(EmailImport).where(EmailImport.message_id == raw.message_id)
    )
    if existing.scalar_one_or_none():
        logger.info("email_processor: ya importado message_id=%s", raw.message_id)
        return {"legs": 0, "expenses": 0}

    # ── Parsear tramos de viaje ────────────────────────────────────────────
    result = parse_travel_email_text(raw.body_text, raw.ics_content)
    logger.info(
        "email_processor: %s → type=%s confidence=%.2f",
        raw.message_id, result.leg_type, result.confidence,
    )

    legs_created = 0
    if result.leg_type != "unknown" or result.confidence > 0:
        db.add(_leg_from_result(user.id, result))
        legs_created = 1

    # ── Procesar adjuntos de imagen ────────────────────────────────────────
    expenses_created = 0
    if raw.image_attachments:
        active_trip_id = await _get_active_trip_id(db, user.id)
        if active_trip_id:
            for mime_type, image_bytes in raw.image_attachments:
                expense = await _create_expense_from_image(
                    db, image_bytes, mime_type, user,
                    active_trip_id, raw.subject,
                )
                if expense:
                    expenses_created += 1
        else:
            logger.info(
                "email_processor: adjuntos de imagen ignorados — no hay viaje activo para user=%s",
                user.id,
            )

    # ── Registrar importación ──────────────────────────────────────────────
    db.add(EmailImport(
        message_id=raw.message_id,
        user_id=user.id,
        legs_created=legs_created + expenses_created,
    ))

    # ── Notificación ──────────────────────────────────────────────────────
    parts = []
    if legs_created:
        parts.append(f"{legs_created} tramo pendiente de asignación")
    if expenses_created:
        parts.append(f"{expenses_created} gasto{'s' if expenses_created > 1 else ''} en borrador")

    if parts:
        title = "Email importado: " + ", ".join(parts)
    else:
        title = "Email: no se encontraron datos de viaje ni tickets"

    db.add(Notification(
        user_id=user.id,
        type="email_imap",
        title=title,
        message=f"Asunto: {raw.subject}" if raw.subject else None,
    ))

    return {"legs": legs_created, "expenses": expenses_created}


async def process_pending_emails(force: bool = False) -> dict:
    """Punto de entrada para el scheduler y el endpoint poll-now.

    force=True salta el check de imap_enabled (usado por poll-now manual).
    """
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        user = await _resolve_user(db)
        if not user:
            logger.warning("email_processor: no hay usuario configurado")
            return {"processed": 0, "legs_created": 0, "expenses_created": 0}

        cfg = await _get_imap_config(db, user.id)

        if not force and not cfg["enabled"]:
            logger.debug("email_processor: IMAP desactivado para user=%s", user.id)
            return {"processed": 0, "legs_created": 0, "expenses_created": 0}

        if not (cfg["host"] and cfg["user"] and cfg["password"]):
            logger.debug("email_processor: credenciales IMAP incompletas")
            return {"processed": 0, "legs_created": 0, "expenses_created": 0}

        try:
            emails = await fetch_unseen_emails(
                host=cfg["host"],
                port=cfg["port"],
                user=cfg["user"],
                password=cfg["password"],
                folder=cfg["folder"],
                sender_filter=cfg["sender_filter"],
            )
        except Exception as exc:
            logger.error("email_processor: error IMAP: %s", exc)
            return {"processed": 0, "legs_created": 0, "expenses_created": 0, "error": str(exc)}

        processed = 0
        total_legs = 0
        total_expenses = 0
        for raw in emails:
            counts = await _process_raw_email(db, raw, user)
            processed += 1
            total_legs += counts.get("legs", 0)
            total_expenses += counts.get("expenses", 0)

        if processed:
            await db.commit()

        logger.info(
            "email_processor: %d emails procesados, %d tramos, %d gastos",
            processed, total_legs, total_expenses,
        )
        return {"processed": processed, "legs_created": total_legs, "expenses_created": total_expenses}
