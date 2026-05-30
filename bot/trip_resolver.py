import logging
from datetime import date

from session import ChatSession

logger = logging.getLogger(__name__)


async def resolve_active_trip(session: ChatSession, trips: list[dict]) -> dict | None:
    """Devuelve el viaje activo siguiendo la cascada de prioridad."""
    # 1. ¿Viaje forzado en sesión?
    if session.forced_trip_id:
        for t in trips:
            if t["id"] == session.forced_trip_id:
                return t

    # 2. ¿Exactamente 1 viaje activo hoy?
    today = date.today().isoformat()
    active = [
        t for t in trips
        if t["start_date"] <= today <= t["end_date"] and t["status"] == "active"
    ]
    if len(active) == 1:
        return active[0]

    # 3. Varios activos → el llamador debe mostrar inline keyboard
    if len(active) > 1:
        return None  # ambiguo: el handler mostrará opciones

    # 4. Ninguno activo
    return None
