"""
travel_email_parser.py — Parser genérico de emails de confirmación de viaje.

Soporta:
- Vuelos (texto plano y HTML), idiomas: ES, EN, FR
- Hoteles (texto plano y HTML), idiomas: ES, EN, FR
- Coches de alquiler, idiomas: ES, EN, FR
- Trenes (Renfe, Eurostar, Thalys, SNCF, DB...), idiomas: ES, EN, FR
- Adjuntos .ics / iCalendar (cualquier agencia)

Arquitectura de dos fases:
  1. Clasificación: detectar el tipo de leg por keywords
  2. Extracción: aplicar patrones del tipo detectado

Si la extracción falla o la confianza es baja, se devuelve un leg vacío
con confirmed=False para que el usuario lo rellene manualmente.

Puntos de entrada:
  parse_travel_email(raw_bytes)               → desde email crudo (bytes)
  parse_travel_email_text(text, ics_content)  → desde texto ya extraído (webhook/IMAP)
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from email import message_from_bytes
from email.message import Message
from typing import Optional

try:
    from icalendar import Calendar
    _HAS_ICALENDAR = True
except ImportError:
    _HAS_ICALENDAR = False

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Resultado del parser
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class TravelParseResult:
    """Resultado de parsear un email de viaje.

    Si confidence < 0.4, el leg tiene campos mínimos y confirmed=False.
    El campo parser_notes explica qué no se pudo extraer.
    """
    leg_type: str                          # flight | hotel | car_rental | train | unknown
    confidence: float                      # 0.0–1.0
    confirmed: bool = False                # siempre False — el usuario confirma en app

    # Campos comunes
    origin: Optional[str] = None
    destination: Optional[str] = None
    locator_code: Optional[str] = None    # PNR / código de confirmación
    reservation_number: Optional[str] = None

    # Transporte (vuelo / tren)
    departure_local: Optional[datetime] = None
    arrival_local: Optional[datetime] = None
    carrier: Optional[str] = None
    flight_number: Optional[str] = None

    # Hotel
    accommodation_name: Optional[str] = None
    accommodation_address: Optional[str] = None
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None

    # Coche
    rental_company: Optional[str] = None
    pickup_location: Optional[str] = None
    dropoff_location: Optional[str] = None
    pickup_datetime: Optional[datetime] = None
    dropoff_datetime: Optional[datetime] = None
    confirmation_number: Optional[str] = None

    # Diagnóstico
    parser_notes: Optional[str] = None
    source_format: str = "unknown"        # "text_plain" | "html" | "ics"


def _empty_result(notes: str = "No se reconoció el formato del email") -> TravelParseResult:
    return TravelParseResult(
        leg_type="unknown",
        confidence=0.0,
        confirmed=False,
        parser_notes=notes,
        source_format="unknown",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Fase 1 — Extracción de texto y clasificación
# ─────────────────────────────────────────────────────────────────────────────

# Keywords por tipo de leg (ES + EN + FR)
_FLIGHT_KEYWORDS = [
    # EN
    "flight", "boarding", "departure", "arrival", "airline", "aircraft",
    "gate", "seat", "itinerary", "e-ticket", "eticket",
    # ES
    "vuelo", "embarque", "salida", "llegada", "aerolínea", "aerolinea",
    "puerta", "asiento", "billete", "localizador",
    # FR
    "vol ", "embarquement", "départ", "arrivée", "compagnie aérienne",
    "porte ", "siège", "billet",
    # Códigos IATA frecuentes en asuntos
    r"\b[A-Z]{2}\d{3,4}\b",   # IB6827, VY1234
]

_HOTEL_KEYWORDS = [
    # EN
    "hotel", "check-in", "check-out", "checkout", "checkin", "reservation",
    "accommodation", "room", "property", "hostel", "resort",
    # ES
    "hotel", "registro", "salida del hotel", "habitación", "habitacion",
    "reserva", "alojamiento", "hostal",
    # FR
    "hôtel", "hotel", "chambre", "arrivée prévue", "départ prévu",
    "réservation",
]

_CAR_KEYWORDS = [
    # EN
    "car rental", "car hire", "vehicle", "pickup", "drop-off", "dropoff",
    "rental confirmation", "rent a car",
    # ES
    "alquiler de coche", "alquiler de vehículo", "recogida", "devolución",
    "devolucion", "coche de alquiler",
    # FR
    "location de voiture", "véhicule", "prise en charge", "restitution",
]

_TRAIN_KEYWORDS = [
    # EN
    "train", "rail", "railway", "coach", "carriage",
    "eurostar", "thalys", "intercity",
    # ES
    "tren", "ave ", "renfe", "ferroviario", "vagón", "vagon",
    "ave", "regional", "cercanías", "cercanias",
    # FR
    "train", "sncf", "tgv", "voiture", "quai",
    # Operadoras
    "db bahn", "deutschebahn", "deutsche bahn",
    "trenitalia", "italotreno",
]


def extract_text_from_email(raw_bytes: bytes) -> tuple[str, str, list[str]]:
    """Extrae texto plano, HTML y adjuntos ICS de un email raw.

    Returns:
        (text_plain, text_html, ics_list)
        ics_list: lista de strings con el contenido de cada adjunto .ics
    """
    msg: Message = message_from_bytes(raw_bytes)
    text_plain = ""
    text_html = ""
    ics_list: list[str] = []

    for part in msg.walk():
        ct = part.get_content_type()
        fn = (part.get_filename() or "").lower()
        charset = part.get_content_charset() or "utf-8"

        if ct == "text/plain" and not text_plain:
            try:
                text_plain = part.get_payload(decode=True).decode(charset, errors="replace")
            except Exception:
                pass

        elif ct == "text/html" and not text_html:
            try:
                text_html = part.get_payload(decode=True).decode(charset, errors="replace")
            except Exception:
                pass

        elif ct == "text/calendar" or fn.endswith(".ics"):
            try:
                ics_list.append(part.get_payload(decode=True).decode(charset, errors="replace"))
            except Exception:
                pass

    return text_plain, text_html, ics_list


def _strip_html(html: str) -> str:
    """Elimina tags HTML y decodifica entidades básicas."""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()


def classify_email(text: str) -> tuple[str, float]:
    """Detecta el tipo de leg más probable en el texto.

    Returns:
        (leg_type, confidence_hint)
        leg_type: "flight" | "hotel" | "car_rental" | "train" | "unknown"
        confidence_hint: 0.0–1.0 (solo orientativo para la fase de extracción)
    """
    text_lower = text.lower()

    def score(keywords: list[str]) -> int:
        count = 0
        for kw in keywords:
            if re.search(kw if kw.startswith(r"\b") else re.escape(kw), text_lower):
                count += 1
        return count

    scores = {
        "flight":     score(_FLIGHT_KEYWORDS),
        "hotel":      score(_HOTEL_KEYWORDS),
        "car_rental": score(_CAR_KEYWORDS),
        "train":      score(_TRAIN_KEYWORDS),
    }

    logger.debug("Email classification scores: %s", scores)

    best_type = max(scores, key=lambda k: scores[k])
    best_score = scores[best_type]

    if best_score == 0:
        return "unknown", 0.0

    # Confianza orientativa: normalizada sobre el máximo posible razonable (8 hits)
    confidence_hint = min(best_score / 8.0, 1.0)
    return best_type, confidence_hint


# ─────────────────────────────────────────────────────────────────────────────
# Utilidades de extracción comunes
# ─────────────────────────────────────────────────────────────────────────────

# Patrones de localizador / PNR
_LOCATOR_PATTERNS = [
    # Etiqueta + código (ES/EN/FR)
    r"(?:localizador|pnr|booking\s*(?:reference|code|number)|confirmation\s*(?:number|code)|"
    r"réservation|numéro\s*de\s*réservation|référence|confirmaci[oó]n)[:\s#]+([A-Z0-9\-]{4,12})",
    # Etiqueta genérica
    r"(?:reference|ref\.?)[:\s#]+([A-Z0-9\-]{5,12})",
    # Código IATA puro en línea propia (6 mayúsculas/dígitos)
    r"\b([A-Z]{2}[A-Z0-9]{4})\b",
]

# Patrones de número de vuelo: XX9999 o XX 9999
_FLIGHT_NUMBER_RE = re.compile(
    r"\b([A-Z]{2})\s*(\d{1,4})\b"
)

# Patrones de fecha — formatos comunes en confirmaciones
_DATE_PATTERNS = [
    # ISO: 2024-05-15 o 2024-05-15T20:30
    (r"(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})",           "%Y-%m-%d %H:%M"),
    (r"(\d{4}-\d{2}-\d{2})",                              "%Y-%m-%d"),
    # EU: 15/05/2024 20:30 o 15-05-2024
    (r"(\d{2}[/-]\d{2}[/-]\d{4})\s+(\d{2}:\d{2})",      "%d/%m/%Y %H:%M"),
    (r"(\d{2}[/-]\d{2}[/-]\d{4})",                        "%d/%m/%Y"),
    # US: May 15, 2024 8:30 PM
    (r"([A-Za-z]+ \d{1,2},\s*\d{4})\s+(\d{1,2}:\d{2}\s*[AP]M)", "%B %d, %Y %I:%M %p"),
    (r"([A-Za-z]+ \d{1,2},\s*\d{4})",                    "%B %d, %Y"),
    # ES: 15 de mayo de 2024 a las 20:30
    (r"(\d{1,2} de \w+ de \d{4})\s+a\s+las\s+(\d{2}:\d{2})", None),  # handler especial
    # FR: 15 mai 2024 à 20h30
    (r"(\d{1,2} \w+ \d{4})\s+[àa]\s+(\d{2}h\d{2})", None),
]

_MESES_ES = {
    "enero": "01", "febrero": "02", "marzo": "03", "abril": "04",
    "mayo": "05", "junio": "06", "julio": "07", "agosto": "08",
    "septiembre": "09", "octubre": "10", "noviembre": "11", "diciembre": "12",
}
_MOIS_FR = {
    "janvier": "01", "février": "02", "mars": "03", "avril": "04",
    "mai": "05", "juin": "06", "juillet": "07", "août": "08",
    "septembre": "09", "octobre": "10", "novembre": "11", "décembre": "12",
}


def _parse_date(text: str, *, after_label: str = "") -> Optional[datetime]:
    """Intenta parsear una fecha de una cadena de texto.

    Si after_label está definido, solo busca fechas que aparecen
    después de esa etiqueta (evita confusiones entre salida y llegada).
    """
    search_text = text
    if after_label:
        idx = text.lower().find(after_label.lower())
        if idx != -1:
            search_text = text[idx:]

    for pattern, fmt in _DATE_PATTERNS:
        m = re.search(pattern, search_text, re.IGNORECASE)
        if not m:
            continue
        try:
            if fmt is None:
                # Handlers especiales para ES y FR
                date_str = m.group(1).lower()
                time_str = m.group(2) if m.lastindex >= 2 else "00:00"
                # ES: "15 de mayo de 2024"
                for mes, num in _MESES_ES.items():
                    date_str = date_str.replace(f" de {mes} ", f"/{num}/")
                date_str = re.sub(r"de ", "", date_str).strip()
                # FR: "15 mai 2024"
                for mois, num in _MOIS_FR.items():
                    date_str = date_str.replace(mois, num)
                # Normalizar separadores
                date_str = re.sub(r"\s+", "/", date_str.strip())
                time_str = time_str.replace("h", ":").replace("H", ":")
                combined = f"{date_str} {time_str}"
                return datetime.strptime(combined, "%d/%m/%Y %H:%M")
            else:
                groups = m.groups()
                date_time_str = " ".join(g for g in groups if g)
                # Normalizar separadores EU
                date_time_str = date_time_str.replace("-", "/")
                return datetime.strptime(date_time_str, fmt.replace("-", "/"))
        except (ValueError, IndexError):
            continue

    return None


def _extract_locator(text: str) -> Optional[str]:
    """Extrae el primer localizador/PNR encontrado."""
    for pattern in _LOCATOR_PATTERNS:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return m.group(1).upper().strip()
    return None


def _extract_iata_codes(text: str) -> list[str]:
    """Extrae todos los códigos IATA de aeropuerto (3 letras mayúsculas)."""
    _STOPWORDS = {"THE", "AND", "FOR", "NOT", "YOU", "ARE", "BUT",
                  "ALL", "CAN", "HAS", "HER", "HIS", "ITS", "NOW"}
    codes = re.findall(r"\b([A-Z]{3})\b", text)
    return [c for c in codes if c not in _STOPWORDS]


# ─────────────────────────────────────────────────────────────────────────────
# Fase 2 — Extractores por tipo
# ─────────────────────────────────────────────────────────────────────────────

def parse_flight(text: str, source_format: str = "text") -> TravelParseResult:
    """Extrae datos de una confirmación de vuelo."""
    result = TravelParseResult(
        leg_type="flight",
        confidence=0.0,
        source_format=source_format,
    )
    fields_found = 0

    # ── Número de vuelo ───────────────────────────────────────────────────────
    m = _FLIGHT_NUMBER_RE.search(text)
    if m:
        result.carrier = m.group(1)
        result.flight_number = f"{m.group(1)}{m.group(2)}"
        fields_found += 2

    # ── Códigos IATA de aeropuerto ────────────────────────────────────────────
    route_m = re.search(
        r"\b([A-Z]{3})\s*(?:→|->|–|-|to|a|hasta|vers)\s*([A-Z]{3})\b",
        text, re.IGNORECASE
    )
    if route_m:
        result.origin = route_m.group(1).upper()
        result.destination = route_m.group(2).upper()
        fields_found += 2
    else:
        orig_m = re.search(
            r"(?:from|de|origen|origin|departure\s*city|ciudad\s*de\s*salida|ville\s*de\s*départ)"
            r"[:\s]+([A-Z]{3}|\w[\w\s]{2,30})",
            text, re.IGNORECASE
        )
        dest_m = re.search(
            r"(?:to|a|destino|destination|arrival\s*city|ciudad\s*de\s*llegada|ville\s*d[\'']arrivée)"
            r"[:\s]+([A-Z]{3}|\w[\w\s]{2,30})",
            text, re.IGNORECASE
        )
        if orig_m:
            result.origin = orig_m.group(1).strip()
            fields_found += 1
        if dest_m:
            result.destination = dest_m.group(1).strip()
            fields_found += 1

    # ── Fechas de salida y llegada ────────────────────────────────────────────
    depart_labels = ["departure", "salida", "départ", "departs", "sale", "check-in"]
    arrive_labels = ["arrival", "llegada", "arrivée", "arrives", "llega"]

    for label in depart_labels:
        dt = _parse_date(text, after_label=label)
        if dt:
            result.departure_local = dt
            fields_found += 1
            break

    for label in arrive_labels:
        dt = _parse_date(text, after_label=label)
        if dt:
            result.arrival_local = dt
            fields_found += 1
            break

    # Si no encontramos con etiquetas, coger la primera y segunda fecha del texto
    if not result.departure_local or not result.arrival_local:
        all_dates: list[datetime] = []
        for pattern, fmt in _DATE_PATTERNS:
            if fmt is None:
                continue
            for m_d in re.finditer(pattern, text, re.IGNORECASE):
                try:
                    groups = m_d.groups()
                    s = " ".join(g for g in groups if g)
                    s = s.replace("-", "/")
                    dt = datetime.strptime(s, fmt.replace("-", "/"))
                    all_dates.append(dt)
                except (ValueError, IndexError):
                    pass
        if len(all_dates) >= 2 and not result.departure_local:
            result.departure_local = all_dates[0]
            result.arrival_local = all_dates[1]
            fields_found += 2
        elif len(all_dates) == 1 and not result.departure_local:
            result.departure_local = all_dates[0]
            fields_found += 1

    # ── Localizador ───────────────────────────────────────────────────────────
    result.locator_code = _extract_locator(text)
    if result.locator_code:
        fields_found += 1

    # ── Aerolínea por nombre si no detectamos por código ─────────────────────
    if not result.carrier:
        airline_m = re.search(
            r"(?:airline|aerolínea|compagnie\s+aérienne|operated\s+by|operado\s+por)[:\s]+"
            r"([\w\s]{3,40}?)(?:\n|,|\.|$)",
            text, re.IGNORECASE
        )
        if airline_m:
            result.carrier = airline_m.group(1).strip()
            fields_found += 1

    # ── Asiento ───────────────────────────────────────────────────────────────
    seat_m = re.search(
        r"(?:seat|asiento|siège)[:\s]+([0-9]{1,3}[A-F]?)",
        text, re.IGNORECASE
    )
    if seat_m:
        note = f"Asiento: {seat_m.group(1)}"
        result.parser_notes = (result.parser_notes + " | " + note) if result.parser_notes else note

    # ── Calcular confianza ────────────────────────────────────────────────────
    # Pesos: origin+destination (2pts), flight_number (1pt), departure (1pt),
    #        arrival (1pt), locator (1pt), carrier (1pt) → máx 7
    result.confidence = min(fields_found / 7.0, 1.0)

    if result.confidence < 0.3:
        note = "Confianza baja — verificar manualmente origen, destino y fechas"
        result.parser_notes = (result.parser_notes + " | " + note) if result.parser_notes else note

    return result


def parse_hotel(text: str, source_format: str = "text") -> TravelParseResult:
    """Extrae datos de una confirmación de hotel."""
    result = TravelParseResult(
        leg_type="hotel",
        confidence=0.0,
        source_format=source_format,
    )
    fields_found = 0

    # ── Nombre del hotel ──────────────────────────────────────────────────────
    hotel_m = re.search(
        r"(?:hotel|property|alojamiento|établissement|hébergement)[:\s]+"
        r"([\w\s\-\&\'\"]{3,60}?)(?:\n|,|\.|$)",
        text, re.IGNORECASE
    )
    if not hotel_m:
        hotel_m = re.search(r"^(Hotel\s+[\w\s\-]{3,50})", text, re.IGNORECASE | re.MULTILINE)
    if hotel_m:
        result.accommodation_name = hotel_m.group(1).strip()
        fields_found += 1

    # ── Dirección ─────────────────────────────────────────────────────────────
    addr_m = re.search(
        r"(?:address|dirección|direccion|adresse)[:\s]+([\w\s\.,\-]{5,100}?)(?:\n|$)",
        text, re.IGNORECASE
    )
    if addr_m:
        result.accommodation_address = addr_m.group(1).strip()
        fields_found += 1

    # ── Check-in ──────────────────────────────────────────────────────────────
    for label in ["check.?in", "llegada", "arrivée", "arrival date", "fecha de entrada"]:
        dt = _parse_date(text, after_label=label)
        if dt:
            result.check_in = dt
            fields_found += 1
            break

    # ── Check-out ─────────────────────────────────────────────────────────────
    for label in ["check.?out", "salida", "départ", "departure date", "fecha de salida"]:
        dt = _parse_date(text, after_label=label)
        if dt:
            result.check_out = dt
            fields_found += 1
            break

    # ── Código de confirmación ────────────────────────────────────────────────
    result.locator_code = _extract_locator(text)
    if result.locator_code:
        fields_found += 1

    # ── Confianza: máx 5 campos ───────────────────────────────────────────────
    result.confidence = min(fields_found / 5.0, 1.0)

    if result.confidence < 0.3:
        result.parser_notes = "Confianza baja — verificar nombre del hotel y fechas manualmente"

    return result


def parse_car(text: str, source_format: str = "text") -> TravelParseResult:
    """Extrae datos de una confirmación de alquiler de coche."""
    result = TravelParseResult(
        leg_type="car_rental",
        confidence=0.0,
        source_format=source_format,
    )
    fields_found = 0

    # ── Empresa de alquiler ───────────────────────────────────────────────────
    company_m = re.search(
        r"(?:rental\s+company|empresa|compañía|société|loueur|alquiler\s+con)[:\s]+"
        r"([\w\s\-]{3,40}?)(?:\n|,|\.|$)",
        text, re.IGNORECASE
    )
    brands = ["hertz", "avis", "europcar", "sixt", "budget", "enterprise",
              "alamo", "national", "goldcar", "record", "firefly"]
    if not company_m:
        for brand in brands:
            if brand in text.lower():
                result.rental_company = brand.capitalize()
                fields_found += 1
                break
    else:
        result.rental_company = company_m.group(1).strip()
        fields_found += 1

    # ── Recogida ──────────────────────────────────────────────────────────────
    for label in ["pick.?up", "recogida", "prise en charge", "pickup location"]:
        loc_m = re.search(
            rf"(?:{label})[:\s]+([\w\s\.,\-]{{5,80}}?)(?:\n|$)",
            text, re.IGNORECASE
        )
        if loc_m:
            result.pickup_location = loc_m.group(1).strip()
            fields_found += 1
        dt = _parse_date(text, after_label=label)
        if dt:
            result.pickup_datetime = dt
            fields_found += 1
        if loc_m or dt:
            break

    # ── Devolución ────────────────────────────────────────────────────────────
    for label in ["drop.?off", "devoluci[oó]n", "restitution", "return location"]:
        loc_m = re.search(
            rf"(?:{label})[:\s]+([\w\s\.,\-]{{5,80}}?)(?:\n|$)",
            text, re.IGNORECASE
        )
        if loc_m:
            result.dropoff_location = loc_m.group(1).strip()
            fields_found += 1
        dt = _parse_date(text, after_label=label)
        if dt:
            result.dropoff_datetime = dt
            fields_found += 1
        if loc_m or dt:
            break

    # ── Número de confirmación ────────────────────────────────────────────────
    result.confirmation_number = _extract_locator(text)
    if result.confirmation_number:
        fields_found += 1

    result.confidence = min(fields_found / 5.0, 1.0)
    if result.confidence < 0.3:
        result.parser_notes = "Confianza baja — verificar empresa, fechas y ubicaciones manualmente"

    return result


def parse_train(text: str, source_format: str = "text") -> TravelParseResult:
    """Extrae datos de una confirmación de tren."""
    result = TravelParseResult(
        leg_type="train",
        confidence=0.0,
        source_format=source_format,
    )
    fields_found = 0

    # ── Origen y destino ──────────────────────────────────────────────────────
    route_m = re.search(
        r"([\w\s\-]{3,30}?)\s*(?:→|->|–|-|to|a|hasta|vers|à)\s*([\w\s\-]{3,30})",
        text, re.IGNORECASE
    )
    if route_m:
        result.origin = route_m.group(1).strip()
        result.destination = route_m.group(2).strip()
        fields_found += 2

    # ── Salida ────────────────────────────────────────────────────────────────
    for label in ["departure", "salida", "départ", "departs"]:
        dt = _parse_date(text, after_label=label)
        if dt:
            result.departure_local = dt
            fields_found += 1
            break

    # ── Llegada ───────────────────────────────────────────────────────────────
    for label in ["arrival", "llegada", "arrivée", "arrives"]:
        dt = _parse_date(text, after_label=label)
        if dt:
            result.arrival_local = dt
            fields_found += 1
            break

    # ── Número de tren / servicio ─────────────────────────────────────────────
    train_m = re.search(
        r"(?:train|tren|avlo?|alvia|ave|tgv|eurostar|thalys|intercity|ic\s*\d|ec\s*\d)"
        r"[\s:]+(\w{1,10})",
        text, re.IGNORECASE
    )
    if train_m:
        result.flight_number = train_m.group(0).strip()  # reutilizamos flight_number para el tren
        fields_found += 1

    # ── Operadora ─────────────────────────────────────────────────────────────
    operators = ["renfe", "sncf", "db ", "deutsche bahn", "eurostar", "thalys",
                 "trenitalia", "italo", "öbb", "ns ", "sbb"]
    for op in operators:
        if op.lower() in text.lower():
            result.carrier = op.strip().capitalize()
            fields_found += 1
            break

    # ── Localizador ───────────────────────────────────────────────────────────
    result.locator_code = _extract_locator(text)
    if result.locator_code:
        fields_found += 1

    result.confidence = min(fields_found / 6.0, 1.0)
    if result.confidence < 0.3:
        result.parser_notes = "Confianza baja — verificar origen, destino y fechas manualmente"

    return result


def parse_ics(ics_str: str) -> TravelParseResult:
    """Parsea un adjunto iCalendar (.ics) — formato universal de agencias de viaje.

    El ICS es la fuente más fiable: campos estructurados, sin regex ambiguos.
    Confianza siempre >= 0.7 si hay campos suficientes.
    """
    if not _HAS_ICALENDAR:
        return _empty_result("Librería icalendar no disponible")

    try:
        cal = Calendar.from_ical(ics_str)
    except Exception as e:
        logger.debug("ICS parse error: %s", e)
        return _empty_result("No se pudo parsear el adjunto ICS")

    result = TravelParseResult(
        leg_type="unknown",
        confidence=0.0,
        source_format="ics",
    )
    fields_found = 0

    for component in cal.walk():
        if component.name != "VEVENT":
            continue

        summary = str(component.get("SUMMARY", "")).strip()
        location = str(component.get("LOCATION", "")).strip()
        description = str(component.get("DESCRIPTION", "")).strip()
        dtstart = component.get("DTSTART")
        dtend = component.get("DTEND")
        uid = str(component.get("UID", "")).strip()

        # Tipo de leg por SUMMARY
        combined = f"{summary} {description}".lower()
        if any(kw in combined for kw in ["flight", "vuelo", "vol ", "boarding"]):
            result.leg_type = "flight"
        elif any(kw in combined for kw in ["hotel", "check-in", "alojamiento", "chambre"]):
            result.leg_type = "hotel"
        elif any(kw in combined for kw in ["car rental", "alquiler", "location de voiture"]):
            result.leg_type = "car_rental"
        elif any(kw in combined for kw in ["train", "tren", "rail", "sncf", "renfe", "tgv"]):
            result.leg_type = "train"
        else:
            result.leg_type = "flight"  # fallback más común en ICS de agencias

        # Fechas
        if dtstart:
            try:
                result.departure_local = (
                    dtstart.dt if isinstance(dtstart.dt, datetime)
                    else datetime.combine(dtstart.dt, datetime.min.time())
                )
                fields_found += 1
            except Exception:
                pass
        if dtend:
            try:
                result.arrival_local = (
                    dtend.dt if isinstance(dtend.dt, datetime)
                    else datetime.combine(dtend.dt, datetime.min.time())
                )
                fields_found += 1
            except Exception:
                pass

        # Location → origen/destino o nombre de hotel
        if location:
            if result.leg_type in ("flight", "train"):
                parts = re.split(r"\s*(?:→|->|–|-|/)\s*", location)
                if len(parts) >= 2:
                    result.origin = parts[0].strip()
                    result.destination = parts[1].strip()
                    fields_found += 2
                else:
                    result.origin = location
                    fields_found += 1
            elif result.leg_type == "hotel":
                result.accommodation_name = summary or location
                result.accommodation_address = location
                fields_found += 2

        # Número de vuelo/tren de SUMMARY: "IB6827 Madrid → Barcelona"
        if result.leg_type == "flight":
            fn_m = _FLIGHT_NUMBER_RE.search(summary)
            if fn_m:
                result.carrier = fn_m.group(1)
                result.flight_number = f"{fn_m.group(1)}{fn_m.group(2)}"
                fields_found += 2

        # Localizador de UID o DESCRIPTION
        result.locator_code = _extract_locator(uid) or _extract_locator(description)
        if result.locator_code:
            fields_found += 1

        break  # solo primer VEVENT

    result.confidence = min(max(fields_found / 5.0, 0.7 if fields_found >= 3 else 0.0), 1.0)
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Funciones principales
# ─────────────────────────────────────────────────────────────────────────────

def _classify_and_extract(text: str, ics_content: str | None = None,
                           source_format: str = "text_plain") -> TravelParseResult:
    """Núcleo compartido: clasificar texto y extraer campos.

    Usado por ambos puntos de entrada (raw bytes y texto ya extraído).
    """
    # ICS tiene prioridad — es el formato más estructurado
    if ics_content and _HAS_ICALENDAR:
        result = parse_ics(ics_content)
        if result.confidence >= 0.4:
            logger.debug("ICS parsed: type=%s confidence=%.2f", result.leg_type, result.confidence)
            return result

    if not text.strip():
        return _empty_result("Email sin contenido de texto legible")

    # Clasificación
    leg_type, confidence_hint = classify_email(text)
    logger.debug("Email classified: type=%s confidence_hint=%.2f", leg_type, confidence_hint)

    if leg_type == "unknown":
        return _empty_result(
            "No se detectaron palabras clave de viaje. "
            "¿Es este un email de confirmación de vuelo, hotel, coche o tren?"
        )

    # Extracción según tipo
    extractors = {
        "flight":     lambda: parse_flight(text, source_format),
        "hotel":      lambda: parse_hotel(text, source_format),
        "car_rental": lambda: parse_car(text, source_format),
        "train":      lambda: parse_train(text, source_format),
    }

    result = extractors[leg_type]()

    # Si la confianza es muy baja, devolver leg con nota
    if result.confidence < 0.2:
        result.parser_notes = (
            f"Tipo detectado: {leg_type}, pero no se pudieron extraer campos suficientes. "
            "Por favor rellena los datos manualmente."
        )
        result.confidence = 0.1

    return result


def parse_travel_email(raw_bytes: bytes) -> TravelParseResult:
    """Punto de entrada principal: email crudo (bytes).

    1. Extrae texto plano, HTML e ICS del email.
    2. Si hay ICS → parsear ICS (más fiable).
    3. Si no, clasificar tipo por keywords y aplicar extractor específico.
    4. Si confianza < 0.2 → leg vacío con nota para el usuario.
    """
    text_plain, text_html, ics_list = extract_text_from_email(raw_bytes)

    # ICS tiene prioridad — es el formato más estructurado
    if ics_list:
        for ics_str in ics_list:
            result = parse_ics(ics_str)
            if result.confidence >= 0.4:
                return result

    # Usar texto plano preferentemente; si no, strip del HTML
    text = text_plain.strip()
    if not text and text_html:
        text = _strip_html(text_html)
        source_format = "html"
    else:
        source_format = "text_plain"

    return _classify_and_extract(text, source_format=source_format)


def parse_travel_email_text(body_text: str, ics_content: str | None = None) -> TravelParseResult:
    """Punto de entrada desde texto ya extraído (webhook IMAP, webhook HTTP).

    Úsalo cuando el email ya ha sido parseado en partes (body_text + ics_content)
    antes de llegar al parser, como ocurre en el webhook y en el procesador IMAP.

    Si hay ics_content, tiene prioridad sobre body_text.
    """
    return _classify_and_extract(
        text=body_text,
        ics_content=ics_content,
        source_format="text_plain",
    )
