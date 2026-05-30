"""OCR provider adapters — interfaz abstracta + adaptadores por motor."""

from app.services.ocr_providers.base import (
    BoardingPassResult,
    LlmOcrProvider,
    OcrProviderError,
    OcrProviderNotConfiguredError,
    OcrResult,
)

__all__ = [
    "BoardingPassResult",
    "LlmOcrProvider",
    "OcrProviderError",
    "OcrProviderNotConfiguredError",
    "OcrResult",
]
