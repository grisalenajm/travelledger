"""Adaptador OCR para OpenAI GPT-4o mini Vision."""

import base64
import json
import logging
from datetime import date as date_t, datetime
from decimal import Decimal, InvalidOperation

from app.services.ocr_providers.base import (
    BoardingPassResult,
    LlmOcrProvider,
    OcrProviderError,
    OcrResult,
)

logger = logging.getLogger(__name__)

_MODEL = "gpt-4o-mini"

_VALID_CATEGORIES = {"Dining", "Lodging", "Transport", "Culture", "Shopping", "Health", "Other"}

_RECEIPT_PROMPT = (
    "Eres un extractor de datos de facturas y tickets de viaje. "
    "Analiza la imagen y devuelve SOLO un JSON válido con estos campos exactos: "
    '{"date":"YYYY-MM-DD o null","amount":número o null,'
    '"currency":"ISO 3 letras o null",'
    '"category":"Dining|Lodging|Transport|Culture|Shopping|Health|Other o null",'
    '"description":"texto corto identificativo o null","confidence":0.0-1.0}. '
    "No incluyas explicaciones. Solo el JSON."
)

_BOARDING_PASS_PROMPT = (
    "Analiza esta tarjeta de embarque y extrae los datos en JSON con estos campos exactos: "
    '{"origin":"IATA o ciudad","destination":"IATA o ciudad",'
    '"departure_local":"YYYY-MM-DDTHH:MM:00 o null",'
    '"arrival_local":"YYYY-MM-DDTHH:MM:00 o null",'
    '"flight_number":"vuelo o null","carrier":"aerolínea o null",'
    '"seat":"asiento o null","locator_code":"localizador o null",'
    '"confidence":0.0-1.0}. '
    "Responde SOLO con el JSON."
)


def _strip_markdown(raw: str) -> str:
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


def _parse_receipt(raw_text: str) -> OcrResult:
    try:
        data = json.loads(_strip_markdown(raw_text))

        parsed_date: date_t | None = None
        if data.get("date") and isinstance(data["date"], str):
            try:
                parsed_date = date_t.fromisoformat(data["date"])
            except ValueError:
                pass

        parsed_amount: Decimal | None = None
        if data.get("amount") is not None:
            try:
                v = Decimal(str(data["amount"]))
                parsed_amount = v if v > 0 else None
            except InvalidOperation:
                pass

        parsed_currency: str | None = None
        if data.get("currency") and isinstance(data["currency"], str) and len(data["currency"]) == 3:
            parsed_currency = data["currency"].upper()

        parsed_category: str | None = None
        if data.get("category") in _VALID_CATEGORIES:
            parsed_category = data["category"]

        description = data.get("description")
        if not isinstance(description, str):
            description = None

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
            description=description,
            confidence=confidence,
            raw_text=raw_text,
        )
    except Exception as exc:
        logger.warning("OpenAI receipt parse error: %s — raw: %.200s", exc, raw_text)
        return OcrResult(raw_text=raw_text)


def _parse_boarding_pass(raw_text: str) -> BoardingPassResult:
    try:
        data = json.loads(_strip_markdown(raw_text))

        departure_local: datetime | None = None
        if data.get("departure_local"):
            try:
                departure_local = datetime.fromisoformat(str(data["departure_local"]))
            except (ValueError, TypeError):
                pass

        arrival_local: datetime | None = None
        if data.get("arrival_local"):
            try:
                arrival_local = datetime.fromisoformat(str(data["arrival_local"]))
            except (ValueError, TypeError):
                pass

        confidence = 0.0
        try:
            confidence = max(0.0, min(1.0, float(data.get("confidence", 0.0))))
        except (TypeError, ValueError):
            pass

        return BoardingPassResult(
            origin=data.get("origin") or None,
            destination=data.get("destination") or None,
            departure_local=departure_local,
            arrival_local=arrival_local,
            flight_number=data.get("flight_number") or None,
            carrier=data.get("carrier") or None,
            seat=data.get("seat") or None,
            locator_code=data.get("locator_code") or None,
            confidence=confidence,
        )
    except Exception as exc:
        logger.warning("OpenAI boarding pass parse error: %s — raw: %.200s", exc, raw_text)
        return BoardingPassResult()


class OpenAiAdapter(LlmOcrProvider):
    """Adaptador OCR para OpenAI GPT-4o mini Vision.

    Nota: GPT-4o mini no admite PDFs. Si se recibe application/pdf
    se devuelve OcrResult vacío con confidence=0 y un aviso en raw_text.
    """

    def __init__(self, api_key: str) -> None:
        try:
            from openai import AsyncOpenAI  # type: ignore[import]
        except ImportError as exc:
            raise ImportError(
                "El paquete 'openai' no está instalado. "
                "Añade 'openai>=1.0' a requirements.txt."
            ) from exc
        self._client = AsyncOpenAI(api_key=api_key)

    async def _call(self, prompt: str, image_bytes: bytes, mime_type: str) -> str:
        """Llama a la API de OpenAI con una imagen y devuelve el texto crudo."""
        if mime_type == "application/pdf":
            # GPT-4o mini no admite PDF — devolvemos cadena vacía para que el caller
            # devuelva un resultado vacío en lugar de crashear.
            logger.warning("OpenAI adapter: PDFs no soportados, devolviendo resultado vacío")
            return "{}"

        encoded = base64.standard_b64encode(image_bytes).decode()
        response = await self._client.chat.completions.create(
            model=_MODEL,
            max_tokens=512,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{encoded}",
                                "detail": "low",
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )
        return response.choices[0].message.content or "{}"

    async def extract(self, image_bytes: bytes, mime_type: str) -> OcrResult:
        logger.info("OpenAI OCR receipt — mime=%s bytes=%d", mime_type, len(image_bytes))
        try:
            raw_text = await self._call(_RECEIPT_PROMPT, image_bytes, mime_type)
            logger.info("OpenAI OCR raw: %.300s", raw_text)
            return _parse_receipt(raw_text)
        except Exception as exc:
            logger.warning("OpenAI OCR error: %s", exc)
            raise OcrProviderError(f"OpenAI OCR error: {exc}") from exc

    async def extract_boarding_pass(
        self, image_bytes: bytes, mime_type: str
    ) -> BoardingPassResult:
        logger.info("OpenAI boarding pass — mime=%s bytes=%d", mime_type, len(image_bytes))
        try:
            raw_text = await self._call(_BOARDING_PASS_PROMPT, image_bytes, mime_type)
            logger.info("OpenAI boarding pass raw: %.300s", raw_text)
            return _parse_boarding_pass(raw_text)
        except Exception as exc:
            logger.warning("OpenAI boarding pass error: %s", exc)
            raise OcrProviderError(f"OpenAI boarding pass error: {exc}") from exc
