import csv
import os
from dataclasses import dataclass

LOGO_BASE = "https://www.gstatic.com/flights/airline_logos/70px/{iata}.png"


@dataclass
class Airline:
    iata: str
    name: str
    country: str

    @property
    def logo_url(self) -> str:
        return LOGO_BASE.format(iata=self.iata)


class AirlineService:
    def __init__(self):
        self._airlines: list[Airline] = []
        self._load()

    def _load(self):
        csv_path = os.path.join(os.path.dirname(__file__), "../data/airlines.csv")
        csv_path = os.path.normpath(csv_path)
        with open(csv_path, encoding="utf-8") as f:
            for row in csv.DictReader(f):
                self._airlines.append(Airline(
                    iata=row["iata"].upper(),
                    name=row["name"],
                    country=row["country"],
                ))

    def search(self, q: str, limit: int = 10) -> list[Airline]:
        if not q or len(q) < 1:
            return []
        q_lower = q.lower().strip()
        results = [
            a for a in self._airlines
            if q_lower in a.iata.lower() or q_lower in a.name.lower()
        ]
        # Priorizar coincidencias exactas de IATA primero, luego IATA startswith, luego nombre startswith
        results.sort(key=lambda a: (
            0 if a.iata.lower() == q_lower else
            1 if a.iata.lower().startswith(q_lower) else
            2 if a.name.lower().startswith(q_lower) else 3
        ))
        return results[:limit]


# Singleton — cargado una vez al arrancar el backend
airline_service = AirlineService()
