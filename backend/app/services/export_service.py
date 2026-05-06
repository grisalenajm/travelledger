import csv
import io
import logging
import re
import unicodedata
import zipfile

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


async def build_csv(
    db: AsyncSession,
    trip: Trip,
    user: User,
    expenses: list[Expense],
    loyalty_cards: dict[str, str],
) -> bytes:
    output = io.StringIO()
    writer = csv.writer(output, delimiter=",", quoting=csv.QUOTE_MINIMAL)

    writer.writerow([
        "date", "description", "category", "billable", "payment_method",
        "loyalty_card", "amount", "currency", "amount_base", "base_currency",
        "exchange_rate", "rate_date", "paperless_url", "image_file",
    ])

    for expense in expenses:
        image_file = ""
        if expense.paperless_doc_id:
            merchant = _slugify(expense.description or "gasto")
            image_file = f"{expense.category.lower()}_{expense.date}_{merchant}.jpg"

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
            expense.payment_method or "",
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


async def build_bundle(
    db: AsyncSession,
    trip: Trip,
    user: User,
    expenses: list[Expense],
    loyalty_cards: dict[str, str],
) -> bytes:
    zip_buffer = io.BytesIO()
    trip_slug = _slugify(trip.name)

    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        csv_bytes = await build_csv(db, trip, user, expenses, loyalty_cards)
        zf.writestr(f"gastos_{trip_slug}.csv", csv_bytes)

        paperless_url, paperless_token = await paperless_service.get_credentials(db, user.id)

        if paperless_url and paperless_token:
            for expense in expenses:
                if not expense.paperless_doc_id:
                    continue
                try:
                    logger.info(
                        "Export bundle — descargando doc_id=%s para expense=%s",
                        expense.paperless_doc_id, expense.id,
                    )
                    image_bytes, content_type = await paperless_service.download_document(
                        paperless_url=paperless_url,
                        token=paperless_token,
                        doc_id=expense.paperless_doc_id,
                    )
                    ext_map = {
                        "image/jpeg": "jpg",
                        "image/png": "png",
                        "image/webp": "webp",
                        "application/pdf": "pdf",
                    }
                    ext = ext_map.get(content_type, "bin")
                    merchant = _slugify(expense.description or "gasto")
                    filename = f"{expense.category.lower()}_{expense.date}_{merchant}.{ext}"
                    zf.writestr(filename, image_bytes)
                except Exception as e:
                    logger.warning(
                        "Export bundle — fallo al descargar doc_id=%s: %s",
                        expense.paperless_doc_id, e,
                    )

    zip_buffer.seek(0)
    return zip_buffer.read()
