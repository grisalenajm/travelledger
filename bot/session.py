import asyncio
import logging
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

TTL_SECONDS = 1800  # 30 minutos
_CLEANUP_INTERVAL = 300  # limpiar cada 5 minutos


@dataclass
class ChatSession:
    chat_id: int
    forced_trip_id: str | None = None
    last_active: float = field(default_factory=time.time)

    def touch(self):
        self.last_active = time.time()

    @property
    def expired(self) -> bool:
        return time.time() - self.last_active > TTL_SECONDS


_sessions: dict[int, ChatSession] = {}


def get_session(chat_id: int) -> ChatSession:
    session = _sessions.get(chat_id)
    if session is None or session.expired:
        session = ChatSession(chat_id=chat_id)
        _sessions[chat_id] = session
    session.touch()
    return session


def clear_session(chat_id: int) -> None:
    _sessions.pop(chat_id, None)


async def cleanup_loop() -> None:
    """Tarea de fondo que elimina sesiones expiradas cada 5 minutos."""
    while True:
        await asyncio.sleep(_CLEANUP_INTERVAL)
        expired_ids = [k for k, v in list(_sessions.items()) if v.expired]
        for k in expired_ids:
            _sessions.pop(k, None)
        if expired_ids:
            logger.debug("Limpiadas %d sesiones expiradas", len(expired_ids))
