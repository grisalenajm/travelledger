import asyncio
import logging
import re
import unicodedata
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import settings_service

logger = logging.getLogger(__name__)

_URL_KEY = "paperless_url"
_TOKEN_KEY = "paperless_token"

CATEGORY_TO_CORRESPONDENT = {
    "Dining": "Comida",
    "Transport": "Transporte",
    "Lodging": "Alojamiento",
    "Culture": "Cultura",
    "Shopping": "Compras",
    "Health": "Salud",
    "Other": "Otros",
}


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9-]+", "-", text.replace(" ", "-")).strip("-")


async def get_credentials(db: AsyncSession, user_id: UUID) -> tuple[str | None, str | None]:
    """Returns (paperless_url, paperless_token) from user settings."""
    url = await settings_service.get(db, user_id, _URL_KEY)
    token = await settings_service.get(db, user_id, _TOKEN_KEY)
    return url, token


async def _get_correspondent_id(
    client: httpx.AsyncClient, base: str, auth_header: dict, name: str
) -> int | None:
    resp = await client.get(
        f"{base}/api/correspondents/", params={"name__iexact": name}, headers=auth_header
    )
    data = resp.json()
    results = data.get("results", [])
    logger.info("correspondent query name=%s results=%s", name, results)
    return results[0]["id"] if results else None


async def _get_document_type_id(
    client: httpx.AsyncClient, base: str, auth_header: dict, name: str = "Invoice"
) -> int | None:
    resp = await client.get(
        f"{base}/api/document_types/", params={"name__iexact": name}, headers=auth_header
    )
    data = resp.json()
    results = data.get("results", [])
    logger.info("document_type query name=%s results=%s", name, results)
    return results[0]["id"] if results else None


async def _get_storage_path_id(
    client: httpx.AsyncClient, base: str, auth_header: dict, name: str = "Viajes"
) -> int | None:
    resp = await client.get(
        f"{base}/api/storage_paths/", params={"name__iexact": name}, headers=auth_header
    )
    data = resp.json()
    results = data.get("results", [])
    logger.info("storage_path query name=%s results=%s", name, results)
    return results[0]["id"] if results else None


async def _get_or_create_tag(base: str, auth_header: dict, name: str) -> int:
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(f"{base}/api/tags/", params={"name": name}, headers=auth_header)
        results = r.json().get("results", [])
        if results:
            return results[0]["id"]
        r = await client.post(f"{base}/api/tags/", headers=auth_header, json={"name": name})
        r.raise_for_status()
        return r.json()["id"]


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
    title_parts: dict | None = None,
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

    category = title_parts.get("category") if title_parts else None
    trip_name = title_parts.get("trip_name") if title_parts else None
    date_str = title_parts.get("date", "") if title_parts else ""

    if trip_name and category:
        trip_slug = slugify(trip_name)
        title = f"{trip_slug}_{category}_{date_str}"
    else:
        title = filename

    tag_id = await _get_or_create_tag(base, auth_header, "travel")

    async with httpx.AsyncClient(timeout=60) as client:
        correspondent_name = CATEGORY_TO_CORRESPONDENT.get(category) if category else None
        correspondent_id, document_type_id, storage_path_id = await asyncio.gather(
            _get_correspondent_id(client, base, auth_header, correspondent_name)
            if correspondent_name
            else asyncio.sleep(0, result=None),
            _get_document_type_id(client, base, auth_header, "Invoice"),
            _get_storage_path_id(client, base, auth_header, "Viajes"),
        )

        form_data: dict[str, str] = {"title": title}
        if correspondent_id is not None:
            form_data["correspondent"] = str(correspondent_id)
        if document_type_id is not None:
            form_data["document_type"] = str(document_type_id)
        if storage_path_id is not None:
            form_data["storage_path"] = str(storage_path_id)
        form_data["tags"] = str(tag_id)

        logger.info(
            "Paperless upload metadata — title=%s correspondent_name=%s correspondent_id=%s "
            "document_type_id=%s storage_path_id=%s tag_id=%s form_data=%s",
            title,
            correspondent_name,
            correspondent_id,
            document_type_id,
            storage_path_id,
            tag_id,
            form_data,
        )

        resp = await client.post(
            f"{base}/api/documents/post_document/",
            headers=auth_header,
            files={"document": (filename, file_bytes, mime_type)},
            data=form_data,
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
