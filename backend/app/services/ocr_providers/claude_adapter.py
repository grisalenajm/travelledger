"""Adaptador Claude Haiku 4.5 Vision — extrae lógica de ocr_service.py y boarding_pass_service.py."""

import base64
import json
import logging
from datetime import date as date_t, datetime
from decimal import Decimal, InvalidOperation

import anthropic

from app.services.ocr_providers.base import (
    BoardingPassResult,
    LlmOcrProvider,
    OcrResult,
)

logger = logging.getLogger(__name__)

_MODEL = "claude-haiku-4-5-20251001"

_VALID_CATEGORIES = {"Dining", "Lodging", "Transport", "Culture", "Shopping", "Health", "Other"}

_RECEIPT_PROMPT = (
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

_BOARDING_PASS_PROMPT = """\
You are an expert aviation data extractor. Your task is to extract structured data
from an airline boarding pass image or PDF and return ONLY a valid JSON object.

Return this exact JSON structure (use null for any field not found):

{
  "flight_number": "BA120",
  "carrier_name": "British Airways",
  "carrier_iata": "BA",
  "origin_iata": "CVG",
  "origin_name": "Cincinnati/Northern Kentucky International Airport",
  "destination_iata": "LHR",
  "destination_name": "London Heathrow Airport",
  "departure_date": "2026-06-05",
  "departure_time": "21:10",
  "arrival_date": null,
  "arrival_time": null,
  "seat": "15F",
  "locator_code": "7ZRJ7R",
  "confidence": 0.95
}

CRITICAL RULES — follow exactly:

1. IATA AIRPORT CODES (origin_iata, destination_iata):
   Use your aviation knowledge to determine the 3-letter IATA code even when it is
   NOT printed on the boarding pass. Map from the airport name or city shown:
   - "Cincinnati Northern Kentucky" or "Cincinnati" -> CVG
   - "London Heathrow" -> LHR
   - "London Gatwick" -> LGW
   - "Madrid Barajas" or "Adolfo Suarez" -> MAD
   - "Barcelona El Prat" -> BCN
   - "Paris Charles de Gaulle" or "Roissy" -> CDG
   - "Paris Orly" -> ORY
   - "Jerez de la Frontera" or "La Parra" -> XRY
   - "Sevilla" or "Seville" -> SVQ
   - "New York JFK" or "John F. Kennedy" -> JFK
   - "New York Newark" -> EWR
   - "Chicago O'Hare" -> ORD
   - "Chicago Midway" -> MDW
   - Apply this logic to any airport worldwide.
   NEVER put city names, random text, or non-IATA strings in origin_iata/destination_iata.
   If you cannot determine the IATA code with high confidence, return null.

2. AIRLINE IATA CODE (carrier_iata):
   Use the standard 2-letter IATA airline code:
   - "British Airways" -> "BA"
   - "Iberia" -> "IB"
   - "American Airlines" -> "AA"
   - "Lufthansa" -> "LH"
   - "Air France" -> "AF"
   - "KLM" -> "KL"
   - "Ryanair" -> "FR"
   - "Vueling" -> "VY"
   - "easyJet" -> "U2"
   - "Delta" -> "DL"
   - "United" -> "UA"
   If the carrier code appears in the flight number (e.g. "BA120"), the first letters
   are the carrier code.

3. FLIGHT NUMBER: Extract exactly as printed (e.g. "BA120", "IB3456"). Include the
   airline prefix. Never return just the numeric part.

4. DATES: Use ISO format YYYY-MM-DD. departure_date is the LOCAL date at origin.
   Do not convert to UTC.

5. TIMES: Use HH:MM 24-hour format. These are LOCAL times at origin/destination.

6. Return ONLY the JSON object. No markdown, no explanation, no code blocks.\
"""


def _strip_markdown(raw: str) -> str:
    """Elimina code fences de markdown que Haiku a veces incluye."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError("No JSON object in response")
    return cleaned[start:end]


def _build_content_and_kwargs(
    image_bytes: bytes, mime_type: str
) -> tuple[dict, dict]:
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
        # Use extra_headers so the standard messages API handles prompt caching
        # alongside the PDF beta — beta.messages.create(betas=["pdfs-2024-09-25"])
        # conflicts with cache_control in system messages.
        extra_kwargs: dict = {"extra_headers": {"anthropic-beta": "pdfs-2024-09-25"}}
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
    return content_block, extra_kwargs


def _parse_receipt_json(raw_text: str) -> OcrResult:
    try:
        cleaned = _strip_markdown(raw_text)
        data = json.loads(cleaned)

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
        if data.get("category") in _VALID_CATEGORIES:
            parsed_category = data["category"]

        parsed_description: str | None = data.get("description")
        if not isinstance(parsed_description, str):
            parsed_description = None

        confidence = 0.0
        try:
            confidence = max(0.0, min(1.0, float(data.get("confidence", 0.0))))
        except (TypeError, ValueError):
            pass

        return OcrResult(
            date=parsed_date,
            amount=parsed_amount,
            currency=parsed_currency,
            category=parsed_category,
            description=parsed_description,
            confidence=confidence,
            raw_text=raw_text,
        )
    except Exception as exc:
        logger.warning("ClaudeHaiku receipt parse error: %s — raw: %.200s", exc, raw_text)
        return OcrResult(raw_text=raw_text)


def _build_datetime(date_str: str | None, time_str: str | None) -> datetime | None:
    """Build a naive local datetime from separate date and time strings."""
    if not date_str:
        return None
    try:
        t = time_str or "00:00"
        return datetime.strptime(f"{date_str} {t}", "%Y-%m-%d %H:%M")
    except ValueError:
        try:
            return datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            return None


def _parse_boarding_pass_json(raw_text: str) -> BoardingPassResult:
    try:
        cleaned = _strip_markdown(raw_text)
        data = json.loads(cleaned)

        # New prompt returns split date+time fields; old format had departure_local ISO string
        departure_local = _build_datetime(
            data.get("departure_date"), data.get("departure_time")
        )
        if departure_local is None and data.get("departure_local"):
            try:
                departure_local = datetime.fromisoformat(str(data["departure_local"]))
            except (ValueError, TypeError):
                pass

        arrival_local = _build_datetime(
            data.get("arrival_date"), data.get("arrival_time")
        )
        if arrival_local is None and data.get("arrival_local"):
            try:
                arrival_local = datetime.fromisoformat(str(data["arrival_local"]))
            except (ValueError, TypeError):
                pass

        # New prompt: origin_iata / destination_iata; old prompt: origin / destination
        origin = data.get("origin_iata") or data.get("origin") or None
        destination = data.get("destination_iata") or data.get("destination") or None

        # carrier_name preferred over legacy carrier field
        carrier = data.get("carrier_name") or data.get("carrier") or None
        carrier_iata = data.get("carrier_iata") or None

        confidence = 0.0
        try:
            confidence = max(0.0, min(1.0, float(data.get("confidence", 0.0))))
        except (TypeError, ValueError):
            pass

        return BoardingPassResult(
            origin=origin,
            destination=destination,
            departure_local=departure_local,
            arrival_local=arrival_local,
            flight_number=data.get("flight_number") or None,
            carrier=carrier,
            carrier_iata=carrier_iata,
            seat=data.get("seat") or None,
            locator_code=data.get("locator_code") or None,
            confidence=confidence,
        )
    except Exception as exc:
        logger.warning("ClaudeHaiku boarding pass parse error: %s — raw: %.200s", exc, raw_text)
        return BoardingPassResult()


class ClaudeHaikuAdapter(LlmOcrProvider):
    """Adaptador OCR para Claude Haiku 4.5 Vision con prompt caching ephemeral."""

    def __init__(self, api_key: str) -> None:
        self._client = anthropic.AsyncAnthropic(api_key=api_key)

    async def extract(self, image_bytes: bytes, mime_type: str) -> OcrResult:
        content_block, extra_kwargs = _build_content_and_kwargs(image_bytes, mime_type)
        messages_kwargs: dict = {
            "model": _MODEL,
            "max_tokens": 512,
            "system": [
                {
                    "type": "text",
                    "text": _RECEIPT_PROMPT,
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

        logger.info("ClaudeHaiku OCR receipt — mime=%s bytes=%d", mime_type, len(image_bytes))

        try:
            response = await self._client.messages.create(**messages_kwargs, **extra_kwargs)
            raw_text = response.content[0].text
            logger.info("ClaudeHaiku OCR raw: %.300s", raw_text)
            return _parse_receipt_json(raw_text)

        except anthropic.APIError:
            raise
        except Exception as exc:
            logger.warning("ClaudeHaiku OCR non-API error: %s", exc)
            return OcrResult()

    async def extract_boarding_pass(
        self, image_bytes: bytes, mime_type: str
    ) -> BoardingPassResult:
        content_block, extra_kwargs = _build_content_and_kwargs(image_bytes, mime_type)
        messages_kwargs: dict = {
            "model": _MODEL,
            "max_tokens": 1024,
            "system": [
                {
                    "type": "text",
                    "text": _BOARDING_PASS_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            "messages": [
                {
                    "role": "user",
                    "content": [
                        content_block,
                        {"type": "text", "text": "Extrae los datos de esta tarjeta de embarque."},
                    ],
                }
            ],
        }

        logger.info(
            "ClaudeHaiku boarding pass — mime=%s bytes=%d", mime_type, len(image_bytes)
        )

        try:
            response = await self._client.messages.create(**messages_kwargs, **extra_kwargs)
            raw_text = response.content[0].text
            logger.info("ClaudeHaiku boarding pass raw: %.300s", raw_text)
            return _parse_boarding_pass_json(raw_text)

        except anthropic.APIError:
            raise
        except Exception as exc:
            logger.warning("ClaudeHaiku boarding pass non-API error: %s", exc)
            return BoardingPassResult()
