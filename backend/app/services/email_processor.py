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
from app.services.leg_import import leg_from_result, resolve_import_user
from app.services.travel_email_parser import parse_travel_email_text
from app.services.imap_service import RawEmail, fetch_unseen_emails

logger = logging.getLogger(__name__)

# Referencias a tareas fire-and-forget: sin esto el GC puede cancelarlas a medias
# (https://docs.python.org/3/library/asyncio-task.html#asyncio.create_task)
_bg_tasks: set[asyncio.Task] = set()


def _spawn_bg(coro) -> None:
    task = asyncio.create_task(coro)
    _bg_tasks.add(task)
    task.add_done_callback(_bg_tasks.discard)


async def _get_imap_config(db: AsyncSession, user_id: UUID) -> dict:
    """Lee config IMAP de user_settings (una sola query), fallback a env vars."""
    from app.services.settings_service import get_all

    data = await get_all(db, user_id)

    port_raw = data.get("mail_imap_port")
    return {
        "host": data.get("mail_host") or settings.IMAP_HOST,
        "port": int(port_raw) if port_raw else settings.IMAP_PORT,
        "user": data.get("mail_user") or settings.IMAP_USER,
        "password": data.get("mail_password") or settings.IMAP_PASSWORD,
        "folder": data.get("mail_imap_folder") or settings.IMAP_FOLDER,
        "sender_filter": data.get("mail_sender_filter") or settings.IMAP_SENDER_FILTER,
        "enabled": data.get("mail_enabled") == "true",
    }


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

    from app.services.image_utils import downscale_for_ocr

    try:
        ocr = await provider.extract(downscale_for_ocr(image_bytes, mime_type), mime_type)
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
        _spawn_bg(geocode_expense_bg(expense.id, ocr.description))

    return expense


async def _find_leg_by_flight_number(
    db: AsyncSession, trip_id: UUID, flight_number: str
) -> TripLeg | None:
    """Busca un leg de vuelo en el viaje activo por número de vuelo normalizado."""
    normalized = flight_number.upper().replace(" ", "")
    result = await db.execute(
        select(TripLeg).where(
            TripLeg.trip_id == trip_id,
            TripLeg.mode == "flight",
            TripLeg.flight_number.isnot(None),
        )
    )
    for leg in result.scalars().all():
        if leg.flight_number and leg.flight_number.upper().replace(" ", "") == normalized:
            return leg
    return None


async def _save_attachment_for_leg(
    file_bytes: bytes, mime_type: str, user_id: UUID, leg_id: UUID
) -> str:
    """Guarda el archivo en /app/uploads/legs/ y devuelve la ruta interna."""
    ext = ".pdf" if mime_type == "application/pdf" else ".jpg"
    dir_path = f"/app/uploads/legs/{user_id}"
    await aiofiles.os.makedirs(dir_path, exist_ok=True)
    path = f"{dir_path}/{leg_id}{ext}"
    async with aiofiles.open(path, "wb") as f:
        await f.write(file_bytes)
    return path


async def _create_leg_from_boarding_pass(
    db: AsyncSession,
    user_id: UUID,
    trip_id: UUID,
    bp: "BoardingPassResult",
    file_bytes: bytes,
    mime_type: str,
) -> TripLeg:
    """Crea un TripLeg mode=flight a partir de los datos de un boarding pass."""
    from app.services.ocr_providers.base import BoardingPassResult  # noqa: F401

    leg_id = uuid4()
    doc_path = await _save_attachment_for_leg(file_bytes, mime_type, user_id, leg_id)
    leg = TripLeg(
        id=leg_id,
        trip_id=trip_id,
        user_id=user_id,
        mode="flight",
        source="email_boarding_pass",
        confirmed=False,
        flight_number=bp.flight_number,
        carrier=bp.carrier,
        origin=bp.origin,
        destination=bp.destination,
        departure_local=bp.departure_local,
        arrival_local=bp.arrival_local,
        seat=bp.seat,
        locator_code=bp.locator_code,
        document_path=doc_path,
    )
    db.add(leg)
    await db.flush()
    return leg


async def _process_attachment(
    db: AsyncSession,
    mime_type: str,
    image_bytes: bytes,
    user: User,
    active_trip_id: UUID,
    processed_bp_keys: set[str],
) -> str:
    """Procesa un adjunto de email intentando primero boarding pass, luego receipt.

    processed_bp_keys: conjunto mutable para deduplicar boarding passes en el mismo email.
    Devuelve: "boarding_pass_linked" | "boarding_pass_new" | "boarding_pass_duplicate" | "expense" | "skipped"
    """
    from app.services.ocr_factory import get_ocr_provider
    from app.services.ocr_providers.base import OcrProviderNotConfiguredError

    try:
        provider = await get_ocr_provider(db, user.id)
    except OcrProviderNotConfiguredError:
        logger.warning("email_processor: OCR no configurado para user=%s", user.id)
        return "skipped"

    # ── Intento 1: boarding pass ─────────────────────────────────────────────
    from app.services.image_utils import downscale_for_ocr

    bp = None
    try:
        bp = await provider.extract_boarding_pass(
            downscale_for_ocr(image_bytes, mime_type), mime_type
        )
    except Exception as exc:
        logger.debug("email_processor: boarding pass extraction failed silently: %s", exc)

    if bp and bp.flight_number:
        dedup_key = f"{bp.flight_number.upper().replace(' ', '')}|{bp.departure_local.date().isoformat() if bp.departure_local else ''}"
        if dedup_key in processed_bp_keys:
            logger.info("email_processor: boarding pass duplicado ignorado: %s", dedup_key)
            return "boarding_pass_duplicate"
        processed_bp_keys.add(dedup_key)

        existing_leg = await _find_leg_by_flight_number(db, active_trip_id, bp.flight_number)
        if existing_leg:
            doc_path = await _save_attachment_for_leg(
                image_bytes, mime_type, user.id, existing_leg.id
            )
            existing_leg.document_path = doc_path
            await db.flush()
            logger.info(
                "email_processor: boarding pass vinculado a leg=%s (vuelo %s)",
                existing_leg.id, bp.flight_number,
            )
            return "boarding_pass_linked"
        else:
            await _create_leg_from_boarding_pass(
                db, user.id, active_trip_id, bp, image_bytes, mime_type
            )
            logger.info(
                "email_processor: leg creado desde boarding pass (vuelo %s)",
                bp.flight_number,
            )
            return "boarding_pass_new"

    # ── Intento 2: receipt normal ────────────────────────────────────────────
    expense = await _create_expense_from_image(db, image_bytes, mime_type, user, active_trip_id, None)
    return "expense" if expense else "skipped"


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
        db.add(leg_from_result(user.id, result))
        legs_created = 1

    # ── Procesar adjuntos de imagen ────────────────────────────────────────
    expenses_created = 0
    bp_linked = 0
    bp_new = 0
    if raw.image_attachments:
        active_trip_id = await _get_active_trip_id(db, user.id)
        if active_trip_id:
            processed_bp_keys: set[str] = set()
            for mime_type, image_bytes in raw.image_attachments:
                result_type = await _process_attachment(
                    db, mime_type, image_bytes, user, active_trip_id, processed_bp_keys
                )
                if result_type == "expense":
                    expenses_created += 1
                elif result_type == "boarding_pass_linked":
                    bp_linked += 1
                elif result_type == "boarding_pass_new":
                    bp_new += 1
        else:
            logger.info(
                "email_processor: adjuntos de imagen ignorados — no hay viaje activo para user=%s",
                user.id,
            )

    # ── Registrar importación ──────────────────────────────────────────────
    db.add(EmailImport(
        message_id=raw.message_id,
        user_id=user.id,
        legs_created=legs_created + bp_new + expenses_created,
    ))

    # ── Notificación ──────────────────────────────────────────────────────
    parts = []
    if legs_created:
        parts.append(f"{legs_created} tramo pendiente de asignación")
    if bp_linked:
        parts.append(f"boarding pass vinculado")
    if bp_new:
        parts.append(f"{bp_new} tramo de vuelo desde boarding pass")
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
        user = await resolve_import_user(db)
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
