from datetime import datetime

from pydantic import BaseModel


class BoardingPassOcrResult(BaseModel):
    """Campos extraídos del boarding pass. Todos opcionales — Haiku extrae lo que puede."""

    origin: str | None = None          # IATA o nombre ciudad
    destination: str | None = None     # IATA o nombre ciudad
    departure_local: datetime | None = None
    arrival_local: datetime | None = None
    flight_number: str | None = None
    carrier: str | None = None
    seat: str | None = None
    locator_code: str | None = None
    confidence: float | None = None    # 0.0–1.0, no se muestra al usuario
