"""Servicio de OCR para tarjetas de embarque.

Delega en el proveedor OCR configurado por el usuario (via ocr_factory).
Convierte BoardingPassResult → BoardingPassOcrResult para el contrato público.
"""

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.boarding_pass import BoardingPassOcrResult
from app.services.image_utils import downscale_for_ocr
from app.services.ocr_factory import get_ocr_provider
from app.services.ocr_providers.base import BoardingPassResult

logger = logging.getLogger(__name__)


def _to_schema(result: BoardingPassResult) -> BoardingPassOcrResult:
    """Convierte el dataclass interno al schema Pydantic que usan los routers."""
    return BoardingPassOcrResult(
        origin=result.origin,
        destination=result.destination,
        departure_local=result.departure_local,
        arrival_local=result.arrival_local,
        flight_number=result.flight_number,
        carrier=result.carrier,
        seat=result.seat,
        locator_code=result.locator_code,
        confidence=result.confidence,
    )


async def extract_boarding_pass(
    image_bytes: bytes,
    media_type: str,
    db: AsyncSession,
    user_id: UUID,
) -> BoardingPassOcrResult:
    """Extrae datos de un boarding pass usando el motor OCR del usuario.

    Args:
        image_bytes: Contenido binario del fichero (jpg/png/webp/pdf).
        media_type:  MIME type validado por magic bytes.
        db:          Sesión de base de datos (para leer user_settings).
        user_id:     ID del usuario (para resolver motor y API key).

    Returns:
        BoardingPassOcrResult con los campos extraídos.
        En caso de fallo de parseo devuelve un resultado vacío (confidence=0).

    Raises:
        OcrProviderNotConfiguredError: si el motor elegido no tiene API key.
        anthropic.APIError / httpx.RequestError: errores de red no recuperables.
    """
    provider = await get_ocr_provider(db, user_id)
    logger.info(
        "Boarding pass OCR — provider=%s mime=%s bytes=%d",
        type(provider).__name__,
        media_type,
        len(image_bytes),
    )
    result = await provider.extract_boarding_pass(
        downscale_for_ocr(image_bytes, media_type), media_type
    )
    return _to_schema(result)
