from app.config import settings


async def get_url(doc_id: int) -> str:
    base = settings.PAPERLESS_URL.rstrip("/")
    return f"{base}/api/documents/{doc_id}/download/"
