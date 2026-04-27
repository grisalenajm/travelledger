import asyncio
import logging
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import settings_service

logger = logging.getLogger(__name__)

_URL_KEY = "paperless_url"
_TOKEN_KEY = "paperless_token"


async def get_credentials(db: AsyncSession, user_id: UUID) -> tuple[str | None, str | None]:
    """Returns (paperless_url, paperless_token) from user settings."""
    url = await settings_service.get(db, user_id, _URL_KEY)
    token = await settings_service.get(db, user_id, _TOKEN_KEY)
    return url, token


async def verify_connection(url: str, token: str) -> tuple[bool, str | None]:
    """Test connectivity to a Paperless-ngx instance. Returns (ok, error_message)."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{url.rstrip('/')}/api/documents/",
                params={"page_size": 1},
                headers={"Authorization": f"Token {token}"},
            )
        if resp.status_code == 200:
            return True, None
        return False, f"HTTP {resp.status_code}"
    except httpx.RequestError as exc:
        logger.warning("paperless_connection_failed url=%s error=%s", url, exc)
        return False, str(exc)


async def get_url(doc_id: int, db: AsyncSession, user_id: UUID) -> str:
    url, _ = await get_credentials(db, user_id)
    if not url:
        raise HTTPException(status.HTTP_424_FAILED_DEPENDENCY, "paperless_url not configured")
    return f"{url.rstrip('/')}/api/documents/{doc_id}/download/"


async def upload_document(
    file_bytes: bytes,
    filename: str,
    mime_type: str,
    db: AsyncSession,
    user_id: UUID,
) -> int:
    """Upload document to Paperless-ngx. Returns document_id after async processing."""
    base_url, token = await get_credentials(db, user_id)
    if not base_url or not token:
        raise HTTPException(
            status.HTTP_424_FAILED_DEPENDENCY,
            "paperless_url or paperless_token not configured",
        )

    base = base_url.rstrip("/")
    auth_header = {"Authorization": f"Token {token}"}

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{base}/api/documents/post_document/",
            headers=auth_header,
            files={"document": (filename, file_bytes, mime_type)},
        )
        if resp.status_code not in (200, 202):
            logger.error("Paperless upload failed: %s %s", resp.status_code, resp.text)
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                f"Paperless upload failed: {resp.status_code}",
            )
        task_id = resp.json()

        # Poll until Paperless finishes processing the document
        for _ in range(30):
            await asyncio.sleep(1)
            task_resp = await client.get(
                f"{base}/api/tasks/?task_id={task_id}",
                headers=auth_header,
            )
            if task_resp.status_code == 200:
                tasks = task_resp.json()
                if tasks and tasks[0]["status"] == "SUCCESS":
                    doc_id = tasks[0].get("related_document")
                    if doc_id:
                        return int(doc_id)
                if tasks and tasks[0]["status"] == "FAILURE":
                    raise HTTPException(
                        status.HTTP_502_BAD_GATEWAY,
                        "Paperless document processing failed",
                    )

    logger.error("Paperless task %s timed out", task_id)
    raise HTTPException(
        status.HTTP_504_GATEWAY_TIMEOUT,
        "Paperless document processing timed out",
    )
