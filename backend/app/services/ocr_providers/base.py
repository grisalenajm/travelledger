"""Interfaz abstracta para proveedores OCR basados en LLM Vision."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date as date_t, datetime
from decimal import Decimal


@dataclass
class OcrResult:
    """Resultado normalizado de OCR de una factura/ticket.

    Campos equivalentes a los que devuelve Haiku en ocr_service.OcrExtracted.
    Todos opcionales — cada adaptador extrae lo que puede.
    """

    date: date_t | None = None
    amount: Decimal | None = None
    currency: str | None = None
    category: str | None = None
    description: str | None = None   # nombre del establecimiento / merchant
    confidence: float = 0.0
    raw_text: str | None = None
    location_lat: float | None = None    # coords GPS (EXIF o geocoding)
    location_lng: float | None = None
    location_name: str | None = None     # nombre legible (merchant) para mostrar al usuario


@dataclass
class BoardingPassResult:
    """Resultado normalizado de OCR de un boarding pass.

    Campos equivalentes a BoardingPassOcrResult de Pydantic.
    """

    origin: str | None = None           # código IATA 3 letras
    destination: str | None = None      # código IATA 3 letras
    departure_local: datetime | None = None
    arrival_local: datetime | None = None
    flight_number: str | None = None
    carrier: str | None = None          # nombre completo de la aerolínea
    carrier_iata: str | None = None     # código IATA 2 letras
    seat: str | None = None
    locator_code: str | None = None
    confidence: float = 0.0


class OcrProviderError(Exception):
    """Error genérico del proveedor OCR."""


class OcrProviderNotConfiguredError(OcrProviderError):
    """El proveedor no está configurado (falta API key u otros parámetros obligatorios)."""


class LlmOcrProvider(ABC):
    """Interfaz abstracta para proveedores OCR basados en LLM Vision.

    Cada adaptador implementa este contrato.
    El factory (ocr_factory.py) selecciona el adaptador según la configuración del usuario.
    """

    @abstractmethod
    async def extract(self, image_bytes: bytes, mime_type: str) -> OcrResult:
        """Extrae datos estructurados de una factura o ticket.

        Args:
            image_bytes: Contenido binario del fichero.
            mime_type: MIME validado por magic bytes (image/jpeg, image/png,
                       image/webp, application/pdf).

        Returns:
            OcrResult con los campos extraídos. Nunca lanza excepción en
            caso de fallo de parseo — devuelve OcrResult() vacío con confidence=0.

        Raises:
            OcrProviderError: Error de red o API no recuperable.
        """
        ...

    @abstractmethod
    async def extract_boarding_pass(
        self, image_bytes: bytes, mime_type: str
    ) -> BoardingPassResult:
        """Extrae datos estructurados de un boarding pass.

        Args / Returns / Raises: igual que extract().
        """
        ...
