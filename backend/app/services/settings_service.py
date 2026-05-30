import logging
import uuid
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto_utils import decrypt, encrypt
from app.models.setting import Setting

logger = logging.getLogger(__name__)

ENCRYPTED_KEYS = {"anthropic_api_key", "paperless_token", "mail_password"}


async def get_all(db: AsyncSession, user_id: UUID) -> dict[str, str | None]:
    result = await db.execute(select(Setting).where(Setting.user_id == user_id))
    rows = {row.key: row.value for row in result.scalars().all()}
    # Decrypt sensitive keys before returning
    for key in ENCRYPTED_KEYS:
        if rows.get(key):
            try:
                rows[key] = decrypt(rows[key])
            except Exception:
                rows[key] = None
    return rows


async def get(db: AsyncSession, user_id: UUID, key: str) -> str | None:
    result = await db.execute(
        select(Setting).where(Setting.user_id == user_id, Setting.key == key)
    )
    row = result.scalar_one_or_none()
    if row is None or row.value is None:
        return None
    if key in ENCRYPTED_KEYS:
        try:
            return decrypt(row.value)
        except Exception:
            return None
    return row.value


async def set(db: AsyncSession, user_id: UUID, key: str, value: str | None) -> None:
    stored_value = value
    if value and key in ENCRYPTED_KEYS:
        stored_value = encrypt(value)
    stmt = (
        pg_insert(Setting)
        .values(id=uuid.uuid4(), user_id=user_id, key=key, value=stored_value)
        .on_conflict_do_update(
            constraint="uq_user_setting",
            set_={"value": stored_value},
        )
    )
    await db.execute(stmt)


async def migrate_to_paperless(db: AsyncSession, user_id: UUID) -> dict:
    """Migrate locally-stored images to Paperless-ngx when the user configures it."""
    from app.services import expense_service, paperless_service  # local import to avoid cycle

    migrated = 0
    failed = 0
    errors: list[str] = []

    expenses = await expense_service.get_with_local_path(db, user_id)
    if not expenses:
        return {"migrated": 0, "failed": 0, "errors": []}

    url, token = await paperless_service.get_credentials(db, user_id)
    if not url or not token:
        logger.warning("migrate_to_paperless: no Paperless credentials for user %s", user_id)
        return {"migrated": 0, "failed": 0, "errors": ["No Paperless credentials configured"]}

    for expense in expenses:
        try:
            local = expense.local_path
            async with __import__("aiofiles").open(local, "rb") as f:
                content = await f.read()
            ext = local.rsplit(".", 1)[-1].lower() if "." in local else ""
            mime = {
                "jpg": "image/jpeg", "jpeg": "image/jpeg",
                "png": "image/png", "webp": "image/webp", "pdf": "application/pdf"
            }.get(ext, "application/octet-stream")
            doc_id = await paperless_service.upload_document(
                content, Path(local).name, mime, db, user_id
            )
            expense.paperless_doc_id = doc_id
            expense.local_path = None
            await db.flush()
            Path(local).unlink(missing_ok=True)
            logger.info("migrate_to_paperless: migrated expense %s → doc_id=%s", expense.id, doc_id)
            migrated += 1
        except Exception as exc:
            logger.error("migrate_to_paperless: expense %s failed: %s", expense.id, exc)
            failed += 1
            errors.append(f"expense {expense.id}: {exc}")
            continue

    return {"migrated": migrated, "failed": failed, "errors": errors}
