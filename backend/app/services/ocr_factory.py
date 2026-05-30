"""Factory de proveedores OCR.

Selecciona el adaptador adecuado según la configuración del usuario.

Uso:
    provider = await get_ocr_provider(db, user_id)
    result   = await provider.extract(image_bytes, mime_type)
    bp       = await provider.extract_boarding_pass(image_bytes, mime_type)
"""

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services.ocr_providers.base import LlmOcrProvider, OcrProviderNotConfiguredError

logger = logging.getLogger(__name__)

# Proveedor por defecto cuando el usuario no ha configurado ninguno
_DEFAULT_PROVIDER = "claude"


async def get_ocr_provider(db: AsyncSession, user_id: UUID) -> LlmOcrProvider:
    """Devuelve el adaptador OCR configurado para el usuario.

    Orden de resolución:
    1. Lee ``ocr_provider`` de user_settings (claude | openai | ollama | gemini)
    2. Default: "claude"
    3. Resuelve API key / URL necesaria (user_settings → fallback .env si aplica)

    Raises:
        OcrProviderNotConfiguredError: si falta la API key requerida por el motor elegido.
    """
    from app.services import settings_service  # import local para evitar ciclo
    from app.services.ocr_providers.claude_adapter import ClaudeHaikuAdapter
    from app.services.ocr_providers.gemini_adapter import GeminiAdapter
    from app.services.ocr_providers.ollama_adapter import OllamaAdapter
    from app.services.ocr_providers.openai_adapter import OpenAiAdapter

    provider_name = (
        await settings_service.get(db, user_id, "ocr_provider") or _DEFAULT_PROVIDER
    )

    if provider_name == "claude":
        user_key = await settings_service.get(db, user_id, "anthropic_api_key")
        resolved = user_key or settings.ANTHROPIC_API_KEY
        if not resolved:
            raise OcrProviderNotConfiguredError(
                "No hay clave API de Anthropic configurada. "
                "Añádela en Ajustes → Perfil → Motor OCR o en el .env del servidor."
            )
        return ClaudeHaikuAdapter(resolved)

    if provider_name == "openai":
        api_key = await settings_service.get(db, user_id, "openai_api_key")
        if not api_key:
            raise OcrProviderNotConfiguredError(
                "No hay clave API de OpenAI configurada. "
                "Añádela en Ajustes → Perfil → Motor OCR."
            )
        return OpenAiAdapter(api_key)

    if provider_name == "ollama":
        url = await settings_service.get(db, user_id, "ollama_url") or "http://localhost:11434"
        model = (
            await settings_service.get(db, user_id, "ollama_model") or "llama3.2-vision"
        )
        return OllamaAdapter(url=url, model=model)

    if provider_name == "gemini":
        api_key = await settings_service.get(db, user_id, "gemini_api_key")
        if not api_key:
            raise OcrProviderNotConfiguredError(
                "No hay clave API de Gemini configurada. "
                "Añádela en Ajustes → Perfil → Motor OCR."
            )
        return GeminiAdapter(api_key)

    # Proveedor desconocido → fallback a Claude con warning
    logger.warning(
        "ocr_provider='%s' desconocido para user=%s — fallback a claude", provider_name, user_id
    )
    user_key = await settings_service.get(db, user_id, "anthropic_api_key")
    resolved = user_key or settings.ANTHROPIC_API_KEY
    if not resolved:
        raise OcrProviderNotConfiguredError(
            "No hay clave API de Anthropic configurada (fallback)."
        )
    return ClaudeHaikuAdapter(resolved)
