"""Webhook para importación de emails de confirmación de viaje."""
import hmac
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.email_import import EmailImport
from app.models.notification import Notification
from app.services.leg_import import leg_from_result, resolve_import_user
from app.services.travel_email_parser import parse_travel_email_text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"], redirect_slashes=False)


# ── Schemas ────────────────────────────────────────────────────────────────────

class EmailWebhookPayload(BaseModel):
    message_id: str
    sender: str = ""
    subject: str = ""
    body_text: str
    body_html: str | None = None
    ics_content: str | None = None


class EmailWebhookResponse(BaseModel):
    legs_created: int
    notification_id: UUID | None = None
    skipped: bool = False


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.post("/email", response_model=EmailWebhookResponse)
async def receive_email(
    payload: EmailWebhookPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> EmailWebhookResponse:
    _validate_secret(request)

    # Deduplicación por message_id
    existing = await db.execute(
        select(EmailImport).where(EmailImport.message_id == payload.message_id)
    )
    if existing.scalar_one_or_none():
        logger.info("Email ya importado: %s", payload.message_id)
        return EmailWebhookResponse(legs_created=0, skipped=True)

    # Parsear email
    result = parse_travel_email_text(payload.body_text, payload.ics_content)
    logger.info(
        "Email %s → type=%s confidence=%.2f",
        payload.message_id, result.leg_type, result.confidence,
    )

    # Resolver usuario
    user = await resolve_import_user(db)
    if not user:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "No hay usuario configurado para el webhook (WEBHOOK_USER_EMAIL)",
        )

    # Crear tramo pendiente de asignación (sin trip_id)
    created_count = 0
    if result.leg_type != "unknown" or result.confidence > 0:
        db.add(leg_from_result(user.id, result))
        created_count = 1

    # Registrar importación (dedup)
    db.add(EmailImport(
        message_id=payload.message_id,
        user_id=user.id,
        legs_created=created_count,
    ))

    # Crear notificación
    if created_count:
        title = "Email: 1 tramo pendiente de asignación"
        message = payload.subject or None
    else:
        title = "Email: no se reconocieron tramos de viaje"
        message = payload.subject or None

    notif = Notification(
        user_id=user.id,
        type="email_import",
        title=title,
        message=message,
    )
    db.add(notif)
    await db.commit()
    await db.refresh(notif)

    logger.info("Importación completada: %d tramos, notificación %s", created_count, notif.id)
    return EmailWebhookResponse(
        legs_created=created_count,
        notification_id=notif.id,
        skipped=False,
    )


# ── Helpers ────────────────────────────────────────────────────────────────────

def _validate_secret(request: Request) -> None:
    provided = request.headers.get("X-Webhook-Secret", "")
    # Comparación en tiempo constante para evitar timing attacks sobre el secreto
    if not settings.WEBHOOK_SECRET or not hmac.compare_digest(provided, settings.WEBHOOK_SECRET):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid webhook secret")
