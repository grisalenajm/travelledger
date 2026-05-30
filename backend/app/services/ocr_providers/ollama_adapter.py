"""Adaptador OCR para Ollama — modelos locales con visión (llama3.2-vision, minicpm-v, etc.).

Llama a la API REST de Ollama: POST /api/generate con la imagen en base64.

Notas AMD ROCm (MSI Vector 16HX / RX 7700S RDNA3):
  - Ollama con soporte GPU AMD requiere compilación con ROCm o la imagen Docker con ROCm.
  - Alternativa más simple: ollama ejecutado en CPU (más lento pero funcional).
  - Ver BEST_PRACTICES.md → sección "OCR providers — setup Ollama con AMD ROCm".
"""

import base64
import json
import logging
from datetime import date as date_t, datetime
from decimal import Decimal, InvalidOperation

import httpx

from app.services.ocr_providers.base import (
    BoardingPassResult,
    LlmOcrProvider,
    OcrProviderError,
    OcrResult,
)

logger = logging.getLogger(__name__)

_VALID_CATEGORIES = {"Dining", "Lodging", "Transport", "Culture", "Shopping", "Health", "Other"}

_RECEIPT_PROMPT = (
    "You are a receipt data extractor. Analyze the image and return ONLY a valid JSON object "
    "with these exact fields: "
    '{"date":"YYYY-MM-DD or null","amount":number or null,"currency":"ISO 3 letters or null",'
    '"category":"Dining|Lodging|Transport|Culture|Shopping|Health|Other or null",'
    '"description":"short establishment name or null","confidence":0.0-1.0}. '
    "No explanations. Only the JSON."
)

_BOARDING_PASS_PROMPT = (
    "Analyze this boarding pass and return ONLY a valid JSON with these exact fields: "
    '{"origin":"IATA or city","destination":"IATA or city",'
    '"departure_local":"YYYY-MM-DDTHH:MM:00 or null","arrival_local":"YYYY-MM-DDTHH:MM:00 or null",'
    '"flight_number":"flight or null","carrier":"airline or null",'
    '"seat":"seat or null","locator_code":"PNR or null","confidence":0.0-1.0}. '
    "No explanations. Only the JSON."
)

# Timeout en segundos — los modelos locales pueden tardar más en responder
_TIMEOUT_SECONDS = 120.0


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
        raise ValueError("No JSON object in Ollama response")
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
        logger.warning("Ollama receipt parse error: %s — raw: %.200s", exc, raw_text)
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
        logger.warning("Ollama boarding pass parse error: %s — raw: %.200s", exc, raw_text)
        return BoardingPassResult()


class OllamaAdapter(LlmOcrProvider):
    """Adaptador OCR para modelos locales vía Ollama REST API.

    Nota: Ollama no soporta PDFs de forma nativa. Si se recibe application/pdf
    se devuelve resultado vacío con confidence=0 y un warning en logs.

    El timeout es de 120 segundos por defecto — los modelos de visión locales
    pueden tardar considerablemente en GPUs de gama media o en CPU.
    """

    def __init__(self, url: str = "http://localhost:11434", model: str = "llama3.2-vision") -> None:
        self._url = url.rstrip("/")
        self._model = model

    async def _call(self, prompt: str, image_bytes: bytes, mime_type: str) -> str:
        """Llama a /api/generate de Ollama y devuelve el texto generado."""
        if mime_type == "application/pdf":
            logger.warning(
                "Ollama adapter: PDFs no soportados por modelos de visión locales, "
                "devolviendo resultado vacío"
            )
            return "{}"

        encoded = base64.standard_b64encode(image_bytes).decode()

        payload = {
            "model": self._model,
            "prompt": prompt,
            "images": [encoded],
            "stream": False,
            "options": {"temperature": 0.1},
        }

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
                resp = await client.post(f"{self._url}/api/generate", json=payload)
                resp.raise_for_status()
                data = resp.json()
                return data.get("response", "{}")
        except httpx.ConnectError as exc:
            logger.error("Ollama no disponible en %s: %s", self._url, exc)
            raise OcrProviderError(
                f"No se puede conectar con Ollama en {self._url}. "
                "Verifica que Ollama está corriendo y la URL es correcta."
            ) from exc
        except httpx.HTTPStatusError as exc:
            logger.error("Ollama HTTP error %s: %s", exc.response.status_code, exc)
            raise OcrProviderError(
                f"Ollama devolvió HTTP {exc.response.status_code}. "
                "Verifica que el modelo está descargado (ollama pull llama3.2-vision)."
            ) from exc
        except httpx.TimeoutException as exc:
            raise OcrProviderError(
                f"Ollama tardó más de {_TIMEOUT_SECONDS}s en responder. "
                "El modelo puede estar cargándose — inténtalo de nuevo."
            ) from exc

    async def extract(self, image_bytes: bytes, mime_type: str) -> OcrResult:
        logger.info(
            "Ollama OCR receipt — model=%s mime=%s bytes=%d",
            self._model, mime_type, len(image_bytes),
        )
        raw_text = await self._call(_RECEIPT_PROMPT, image_bytes, mime_type)
        logger.info("Ollama OCR raw: %.300s", raw_text)
        return _parse_receipt(raw_text)

    async def extract_boarding_pass(
        self, image_bytes: bytes, mime_type: str
    ) -> BoardingPassResult:
        logger.info(
            "Ollama boarding pass — model=%s mime=%s bytes=%d",
            self._model, mime_type, len(image_bytes),
        )
        raw_text = await self._call(_BOARDING_PASS_PROMPT, image_bytes, mime_type)
        logger.info("Ollama boarding pass raw: %.300s", raw_text)
        return _parse_boarding_pass(raw_text)
