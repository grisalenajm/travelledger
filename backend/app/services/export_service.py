import csv
import io
import logging
import re
import unicodedata
import zipfile
from pathlib import Path

import aiofiles
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.models.trip import Trip
from app.models.user import User
from app.services import paperless_service

logger = logging.getLogger(__name__)


def _slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")


def _best_effort_filename(expense: Expense) -> str:
    """Returns a best-effort image filename for standalone CSV (no actual download)."""
    base = f"{expense.category.lower()}_{expense.date}_{expense.id}"
    if expense.local_path:
        ext = Path(expense.local_path).suffix or ".jpg"
        return f"{base}{ext}"
    if expense.paperless_doc_id:
        return f"{base}.pdf"
    return ""


async def build_csv(
    db: AsyncSession,
    trip: Trip,
    user: User,
    expenses: list[Expense],
    loyalty_cards: dict[str, str],
    image_map: dict[str, str] | None = None,
) -> bytes:
    output = io.StringIO()
    writer = csv.writer(output, delimiter=",", quoting=csv.QUOTE_MINIMAL)

    writer.writerow([
        "date", "description", "category", "billable", "payment_method",
        "loyalty_card", "amount", "currency", "amount_base", "base_currency",
        "exchange_rate", "rate_date", "paperless_url", "image_file",
    ])

    for expense in expenses:
        if image_map is not None:
            image_file = image_map.get(str(expense.id), "")
        else:
            image_file = _best_effort_filename(expense)

        loyalty = ""
        if expense.loyalty_card_id:
            loyalty = loyalty_cards.get(str(expense.loyalty_card_id), "")

        exchange_rate = ""
        if expense.amount and float(expense.amount) != 0:
            rate = float(expense.amount_base) / float(expense.amount)
            exchange_rate = f"{rate:.6f}"

        writer.writerow([
            str(expense.date),
            expense.description or "",
            expense.category,
            str(expense.billable).lower(),
            "",
            loyalty,
            str(expense.amount),
            expense.currency,
            str(expense.amount_base),
            user.currency_base,
            exchange_rate,
            str(expense.rate_date),
            "",
            image_file,
        ])

    return ("﻿" + output.getvalue()).encode("utf-8")


_EXT_MAP = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
}


async def _collect_images(
    expenses: list[Expense],
    paperless_url: str | None,
    paperless_token: str | None,
) -> dict[str, tuple[str, bytes]]:
    """Returns {expense_id: (filename, bytes)} for expenses that have an image."""
    result: dict[str, tuple[str, bytes]] = {}

    for expense in expenses:
        str_id = str(expense.id)
        base = f"{expense.category.lower()}_{expense.date}_{str_id}"

        if expense.local_path:
            try:
                async with aiofiles.open(expense.local_path, "rb") as f:
                    content = await f.read()
                ext = Path(expense.local_path).suffix or ".jpg"
                result[str_id] = (f"{base}{ext}", content)
                logger.info("Export bundle — local image expense=%s", str_id)
            except Exception as e:
                logger.warning(
                    "Export bundle — fallo leyendo local_path=%s: %s",
                    expense.local_path, e,
                )

        elif expense.paperless_doc_id and paperless_url and paperless_token:
            try:
                image_bytes, content_type = await paperless_service.download_document(
                    paperless_url=paperless_url,
                    token=paperless_token,
                    doc_id=expense.paperless_doc_id,
                )
                ext = _EXT_MAP.get(content_type, ".bin")
                result[str_id] = (f"{base}{ext}", image_bytes)
                logger.info(
                    "Export bundle — Paperless doc_id=%s expense=%s",
                    expense.paperless_doc_id, str_id,
                )
            except Exception as e:
                logger.warning(
                    "Export bundle — fallo al descargar doc_id=%s: %s",
                    expense.paperless_doc_id, e,
                )

    return result


async def build_bundle(
    db: AsyncSession,
    trip: Trip,
    user: User,
    expenses: list[Expense],
    loyalty_cards: dict[str, str],
) -> bytes:
    paperless_url, paperless_token = await paperless_service.get_credentials(db, user.id)
    images = await _collect_images(expenses, paperless_url, paperless_token)

    image_map = {eid: fname for eid, (fname, _) in images.items()}
    csv_bytes = await build_csv(db, trip, user, expenses, loyalty_cards, image_map)

    zip_buffer = io.BytesIO()
    trip_slug = _slugify(trip.name)

    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"gastos_{trip_slug}.csv", csv_bytes)
        for filename, content in images.values():
            zf.writestr(filename, content)

    zip_buffer.seek(0)
    return zip_buffer.read()
