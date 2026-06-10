"""Endpoints de control del polling IMAP."""
import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.dependencies import require_not_guest
from app.database import get_db
from app.models.user import User
from app.services import imap_service
from app.services.email_processor import process_pending_emails

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/email", tags=["email"], redirect_slashes=False)


class PollResult(BaseModel):
    processed: int
    legs_created: int
    expenses_created: int = 0
    error: str | None = None


class TestConnectionResult(BaseModel):
    ok: bool
    error: str | None = None


@router.post("/poll-now", response_model=PollResult)
async def poll_now(
    current_user: User = Depends(require_not_guest),
) -> PollResult:
    result = await process_pending_emails(force=True)
    return PollResult(**result)


@router.post("/test-connection", response_model=TestConnectionResult)
async def test_connection(
    current_user: User = Depends(require_not_guest),
    db: AsyncSession = Depends(get_db),
) -> TestConnectionResult:
    from app.services.settings_service import get_all

    data = await get_all(db, current_user.id)
    host = data.get("mail_host") or settings.IMAP_HOST
    port_raw = data.get("mail_imap_port")
    port = int(port_raw) if port_raw else settings.IMAP_PORT
    user = data.get("mail_user") or settings.IMAP_USER
    password = data.get("mail_password") or settings.IMAP_PASSWORD

    if not (host and user and password):
        return TestConnectionResult(ok=False, error="Credenciales IMAP no configuradas")

    ok, error = await imap_service.test_connection(host, port, user, password)
    return TestConnectionResult(ok=ok, error=error)
