import logging
from typing import Literal

import anthropic

from config import settings

logger = logging.getLogger(__name__)

_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
MODEL = "claude-haiku-4-5-20251001"

Intent = Literal["create", "query", "export", "set_trip", "unknown"]


async def call_haiku(messages: list, system: str) -> str:
    response = await _client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=system,
        messages=messages,
    )
    return response.content[0].text


async def classify_intent(text: str) -> Intent:
    # FASE 8: implementar con prompt caching
    return "unknown"


async def extract_expense(text: str) -> dict:
    # FASE 8: implementar extracción estructurada
    return {}


async def answer_query(text: str, context: dict) -> str:
    # FASE 8: implementar respuesta en lenguaje natural
    return "🚧 Disponible en FASE 8."
