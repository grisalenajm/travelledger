import csv
import logging
import unicodedata
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

_CSV_PATH = Path(__file__).parent.parent / "data" / "airports.csv"


@dataclass(slots=True)
class Airport:
    iata: str
    name: str
    city: str
    country: str
    lat: float
    lng: float


class AirportService:
    """In-memory lookup table for IATA code → Airport. Loaded once at startup."""

    def __init__(self) -> None:
        self._by_iata: dict[str, Airport] = {}
        self._load()

    def _load(self) -> None:
        if not _CSV_PATH.exists():
            logger.warning("airport_service: airports.csv not found at %s", _CSV_PATH)
            return
        with open(_CSV_PATH, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                iata = row["iata"].strip().upper()
                try:
                    lat = float(row["lat"])
                    lng = float(row["lng"])
                except ValueError:
                    continue
                if iata:
                    self._by_iata[iata] = Airport(
                        iata=iata,
                        name=row.get("name", "").strip(),
                        city=row.get("city", "").strip(),
                        country=row.get("country", "").strip(),
                        lat=lat,
                        lng=lng,
                    )
        logger.info("airport_service: loaded %d airports", len(self._by_iata))

    def get_coords(self, iata: str) -> tuple[float, float] | None:
        a = self._by_iata.get(iata.strip().upper())
        return (a.lat, a.lng) if a else None

    def search(self, q: str, limit: int = 10) -> list[Airport]:
        q_strip = q.strip()
        if not q_strip:
            return []
        q_upper = q_strip.upper()
        q_lower = q_strip.lower()
        results: list[Airport] = []
        for airport in self._by_iata.values():
            if (
                airport.iata.startswith(q_upper)
                or q_lower in airport.city.lower()
                or q_lower in airport.name.lower()
            ):
                results.append(airport)
        # Exact IATA match first, then alphabetical; truncate after sort
        results.sort(key=lambda a: (0 if a.iata == q_upper else 1, a.iata))
        return results[:limit]

    def get_by_iata(self, iata: str) -> "Airport | None":
        """Exact lookup by IATA code (case-insensitive)."""
        return self._by_iata.get(iata.strip().upper())

    def search_by_name(
        self, query: str, country: str | None = None
    ) -> "Airport | None":
        """Search by airport name or city, with accent normalization.

        Priority: 1) exact match, 2) starts-with, 3) contains.
        Falls back to global search if country-filtered search returns nothing.
        """
        if not query or len(query.strip()) < 2:
            return None
        q = _normalize(query)

        candidates = list(self._by_iata.values())
        if country:
            country_norm = _normalize(country)
            filtered = [a for a in candidates if _normalize(a.country) == country_norm]
            result = self._search_candidates(q, filtered)
            if result:
                return result
            # retry without country filter
        return self._search_candidates(q, candidates)

    def _search_candidates(
        self, q: str, candidates: "list[Airport]"
    ) -> "Airport | None":
        for a in candidates:
            if _normalize(a.name) == q or _normalize(a.city) == q:
                return a
        for a in candidates:
            if _normalize(a.name).startswith(q) or _normalize(a.city).startswith(q):
                return a
        for a in candidates:
            if q in _normalize(a.name) or q in _normalize(a.city):
                return a
        return None

    @property
    def count(self) -> int:
        return len(self._by_iata)


def _normalize(text: str) -> str:
    """Lowercase, strip accents/diacritics, trim whitespace."""
    nfd = unicodedata.normalize("NFD", text.lower().strip())
    return "".join(c for c in nfd if unicodedata.category(c) != "Mn")


airport_service = AirportService()
