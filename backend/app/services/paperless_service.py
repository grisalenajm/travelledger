import asyncio
import logging

import httpx
from fastapi import HTTPException, status

from app.config import settings

logger = logging.getLogger(__name__)


async def get_url(doc_id: int) -> str:
    base = settings.PAPERLESS_URL.rstrip("/")
    return f"{base}/api/documents/{doc_id}/download/"


async def upload_document(file_bytes: bytes, filename: str, mime_type: str) -> int:
    """Upload document to Paperless-ngx. Returns document_id after async processing."""
    base = settings.PAPERLESS_URL.rstrip("/")
    auth = {"Authorization": f"Token {settings.PAPERLESS_TOKEN}"}

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{base}/api/documents/post_document/",
            headers=auth,
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
                headers=auth,
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
