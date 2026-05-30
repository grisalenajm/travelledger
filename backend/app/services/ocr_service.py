import base64
import json
import logging
from dataclasses import dataclass
from datetime import date as date_t
from decimal import Decimal, InvalidOperation
from uuid import UUID

import anthropic
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

logger = logging.getLogger(__name__)

VALID_CATEGORIES = {"Dining", "Lodging", "Transport", "Culture", "Shopping", "Health", "Other"}

_SYSTEM_PROMPT = (
    "Eres un extractor de datos de facturas y tickets de viaje.\n"
    "Analiza la imagen y devuelve SOLO un JSON válido con estos campos:\n"
    "{\n"
    '  "date": "YYYY-MM-DD o null",\n'
    '  "amount": número o null,\n'
    '  "currency": "ISO 3 letras o null",\n'
    '  "category": "Dining|Lodging|Transport|Culture|Shopping|Health|Other o null",\n'
    '  "description": "texto corto identificativo o null",\n'
    '  "confidence": 0.0-1.0\n'
    "}\n"
    "- date: fecha de la factura, no de hoy\n"
    "- amount: importe total pagado, número sin símbolo\n"
    "- currency: infiere del país/símbolo si no está explícito\n"
    "- category: elige la más probable según el negocio\n"
    "- description: nombre del establecimiento o descripción breve\n"
    "- confidence: tu confianza global en la extracción (1.0 = todo claro)\n"
    "No incluyas explicaciones. Solo el JSON."
)


@dataclass
class OcrExtracted:
    date: date_t | None
    amount: Decimal | None
    currency: str | None
    category: str | None
    description: str | None
    confidence: float
    raw_text: str | None


def _empty(raw_text: str | None = None) -> OcrExtracted:
    return OcrExtracted(
        date=None, amount=None, currency=None, category=None,
        description=None, confidence=0.0, raw_text=raw_text
    )


async def get_api_key(db: AsyncSession, user_id: UUID) -> str | None:
    """Return the Anthropic API key for a user: user setting → env fallback."""
    from app.services import settings_service  # local import to avoid potential cycle
    user_key = await settings_service.get(db, user_id, "anthropic_api_key")
    return user_key or settings.ANTHROPIC_API_KEY


async def extract(image_bytes: bytes, mime_type: str, api_key: str | None = None) -> OcrExtracted:
    """Extract structured receipt data via Haiku 4.5 Vision.

    Never raises on read/parse failure — only on network/API errors.
    """
    try:
        resolved_key = api_key or settings.ANTHROPIC_API_KEY
        client = anthropic.AsyncAnthropic(api_key=resolved_key)
        encoded = base64.standard_b64encode(image_bytes).decode("utf-8")

        if mime_type == "application/pdf":
            content_block: dict = {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": encoded,
                },
            }
            extra_kwargs: dict = {"betas": ["pdfs-2024-09-25"]}
        else:
            content_block = {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": mime_type,
                    "data": encoded,
                },
            }
            extra_kwargs = {}

        messages_kwargs: dict = {
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 512,
            "system": [
                {
                    "type": "text",
                    "text": _SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            "messages": [
                {
                    "role": "user",
                    "content": [
                        content_block,
                        {"type": "text", "text": "Extrae los datos de este ticket/factura."},
                    ],
                }
            ],
        }

        logger.info("OCR request — mime_type=%s bytes=%d", mime_type, len(image_bytes))

        if extra_kwargs:
            response = await client.beta.messages.create(**messages_kwargs, **extra_kwargs)
        else:
            response = await client.messages.create(**messages_kwargs)

        raw_text = response.content[0].text
        logger.info("OCR raw response: %.300s", raw_text)
        return _parse_response(raw_text)

    except anthropic.APIError:
        raise
    except Exception as exc:
        logger.warning("OCR extraction failed (non-API): %s", exc)
        return _empty()


def _parse_response(raw_text: str) -> OcrExtracted:
    try:
        # Haiku sometimes wraps the JSON in markdown code fences — strip them
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip()

        start = cleaned.find("{")
        end = cleaned.rfind("}") + 1
        if start == -1 or end == 0:
            raise ValueError("No JSON object in response")
        data = json.loads(cleaned[start:end])

        parsed_date: date_t | None = None
        raw_date = data.get("date")
        if raw_date and isinstance(raw_date, str):
            try:
                parsed_date = date_t.fromisoformat(raw_date)
            except ValueError:
                pass

        parsed_amount: Decimal | None = None
        raw_amount = data.get("amount")
        if raw_amount is not None:
            try:
                parsed_amount = Decimal(str(raw_amount))
                if parsed_amount <= 0:
                    parsed_amount = None
            except InvalidOperation:
                pass

        parsed_currency: str | None = None
        raw_currency = data.get("currency")
        if raw_currency and isinstance(raw_currency, str) and len(raw_currency) == 3:
            parsed_currency = raw_currency.upper()

        parsed_category: str | None = None
        raw_category = data.get("category")
        if raw_category in VALID_CATEGORIES:
            parsed_category = raw_category

        parsed_description: str | None = data.get("description")
        if not isinstance(parsed_description, str):
            parsed_description = None

        confidence = 0.0
        try:
            confidence = float(data.get("confidence", 0.0))
            confidence = max(0.0, min(1.0, confidence))
        except (TypeError, ValueError):
            pass

        return OcrExtracted(
            date=parsed_date,
            amount=parsed_amount,
            currency=parsed_currency,
            category=parsed_category,
            description=parsed_description,
            confidence=confidence,
            raw_text=raw_text,
        )

    except Exception as exc:
        logger.warning("Failed to parse OCR response: %s — raw: %.200s", exc, raw_text)
        return _empty(raw_text)
