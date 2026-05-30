"""Tests del parser genérico de emails de viaje (travel_email_parser).

Fixtures con emails genéricos — sin datos corporativos ni personales.
"""
from datetime import datetime

import pytest

from app.services.travel_email_parser import (
    TravelParseResult,
    classify_email,
    parse_car,
    parse_flight,
    parse_hotel,
    parse_ics,
    parse_train,
    parse_travel_email,
    parse_travel_email_text,
)

# ─────────────────────────────────────────────────────────────────────────────
# Fixtures — emails genéricos
# ─────────────────────────────────────────────────────────────────────────────

SAMPLE_FLIGHT_EMAIL_EN = b"""
From: noreply@example-airline.com
Subject: Your flight confirmation IB6827

Your booking is confirmed.
Flight: IB6827
From: MAD To: BCN
Departure: 15/06/2024 20:30
Arrival: 15/06/2024 21:45
Seat: 14A
Booking Reference: ABC123
"""

SAMPLE_FLIGHT_EMAIL_ES = b"""
From: confirmacion@ejemplo-aerolinea.com
Subject: Confirmacion de vuelo IB3644

Su vuelo ha sido confirmado.
Vuelo: IB3644
Origen: MAD  Destino: LHR
Salida: 23/05/2026 12:10
Llegada: 23/05/2026 14:30
Asiento: 24C
Localizador: NZJK1
"""

SAMPLE_HOTEL_EMAIL_ES = b"""
From: confirmacion@ejemplo-hotel.com
Subject: Confirmacion de reserva - Hotel Central

Estimado cliente,
Hotel: Hotel Central Madrid
Direccion: Calle Mayor 10, Madrid
Check-in: 15/06/2024
Check-out: 18/06/2024
Codigo de reserva: HTL789
"""

SAMPLE_CAR_EMAIL_EN = b"""
From: confirmation@example-rental.com
Subject: Your car rental confirmation - Hertz

Your Hertz rental is confirmed.
Pickup: Madrid Airport Terminal 4
Pickup Date: 15/06/2024 10:00
Drop-off: Barcelona Airport
Drop-off Date: 18/06/2024 12:00
Confirmation Number: CAR456
"""

SAMPLE_TRAIN_EMAIL_ES = b"""
From: noreply@ejemplo-trenes.com
Subject: Billete confirmado - Tren Madrid-Barcelona

Tren AVE S-103
Madrid Puerta de Atocha -> Barcelona Sants
Salida: 16/06/2024 07:00
Llegada: 16/06/2024 09:30
Localizador: RNF456
"""

SAMPLE_ICS = b"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Example Airline//NONSGML//EN
BEGIN:VEVENT
SUMMARY:Flight IB6827 MAD->BCN
DTSTART:20240615T203000Z
DTEND:20240615T214500Z
LOCATION:MAD -> BCN
DESCRIPTION:Booking Reference: ABC123
UID:abc123@example-airline.com
END:VEVENT
END:VCALENDAR"""

SAMPLE_HOTEL_ICS = b"""BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Hotel Central Madrid - Check-in
DTSTART:20240615
DTEND:20240618
LOCATION:Calle Mayor 10, Madrid
DESCRIPTION:Reservation: HTL789
UID:htl789@example-hotel.com
END:VEVENT
END:VCALENDAR"""

GARBAGE_EMAIL = b"""From: spam@example.com
Subject: Hello

Buy now! Great deals available.
"""


# ─────────────────────────────────────────────────────────────────────────────
# Tests de clasificación
# ─────────────────────────────────────────────────────────────────────────────

def test_classify_flight_en():
    leg_type, _ = classify_email("Your flight IB6827 from MAD to BCN is confirmed")
    assert leg_type == "flight"


def test_classify_hotel_es():
    leg_type, _ = classify_email("Hotel confirmado. Check-in 15/06/2024. Reserva HTL789")
    assert leg_type == "hotel"


def test_classify_car_en():
    leg_type, _ = classify_email("Car rental confirmation. Hertz pickup at airport.")
    assert leg_type == "car_rental"


def test_classify_train_es():
    leg_type, _ = classify_email("Billete de tren confirmado. Renfe AVE Madrid-Barcelona")
    assert leg_type == "train"


def test_classify_unknown():
    leg_type, confidence = classify_email("Buy now! Great deals!")
    assert leg_type == "unknown"
    assert confidence == 0.0


# ─────────────────────────────────────────────────────────────────────────────
# Tests de extracción — vuelo
# ─────────────────────────────────────────────────────────────────────────────

def test_parse_flight_number():
    text = "Flight IB6827 confirmed. Departure from MAD."
    result = parse_flight(text)
    assert result.flight_number == "IB6827"
    assert result.carrier == "IB"


def test_parse_flight_route():
    text = "MAD -> BCN. Departure 15/06/2024 20:30"
    result = parse_flight(text)
    assert result.origin == "MAD"
    assert result.destination == "BCN"


def test_parse_flight_dates():
    text = "Departure: 15/06/2024 20:30\nArrival: 15/06/2024 21:45"
    result = parse_flight(text)
    assert result.departure_local == datetime(2024, 6, 15, 20, 30)
    assert result.arrival_local == datetime(2024, 6, 15, 21, 45)


def test_parse_flight_locator():
    text = "Booking Reference: ABC123\nFlight IB6827 MAD BCN"
    result = parse_flight(text)
    assert result.locator_code == "ABC123"


def test_parse_flight_confidence():
    text = "Flight IB6827 from MAD to BCN. Departure 15/06/2024 20:30. Arrival 21:45. Ref ABC123"
    result = parse_flight(text)
    assert result.confidence >= 0.5


# ─────────────────────────────────────────────────────────────────────────────
# Tests de extracción — hotel
# ─────────────────────────────────────────────────────────────────────────────

def test_parse_hotel_name():
    text = "Hotel: Hotel Central Madrid\nCheck-in: 15/06/2024"
    result = parse_hotel(text)
    assert "Central" in (result.accommodation_name or "")


def test_parse_hotel_dates():
    text = "Hotel: Hotel Central\nCheck-in: 15/06/2024\nCheck-out: 18/06/2024"
    result = parse_hotel(text)
    assert result.check_in is not None
    assert result.check_out is not None


def test_parse_hotel_address():
    text = "Hotel: Hotel Central\nAddress: Calle Mayor 10, Madrid"
    result = parse_hotel(text)
    assert "Calle Mayor" in (result.accommodation_address or "")


def test_parse_hotel_locator():
    text = "Hotel: Test Hotel\nConfirmation number: HTL789"
    result = parse_hotel(text)
    assert result.locator_code == "HTL789"


# ─────────────────────────────────────────────────────────────────────────────
# Tests de extracción — coche
# ─────────────────────────────────────────────────────────────────────────────

def test_parse_car_brand_detection():
    text = "Your Hertz rental is confirmed. Pickup at Madrid Airport."
    result = parse_car(text)
    assert result.rental_company is not None
    assert "hertz" in result.rental_company.lower()


def test_parse_car_confidence():
    text = "Car rental confirmed. Hertz pickup Madrid Airport 15/06/2024 10:00"
    result = parse_car(text)
    assert result.confidence >= 0.2


# ─────────────────────────────────────────────────────────────────────────────
# Tests de extracción — tren
# ─────────────────────────────────────────────────────────────────────────────

def test_parse_train_operator():
    text = "Billete RENFE confirmado. AVE Madrid - Barcelona. Salida 07:00"
    result = parse_train(text)
    assert result.carrier is not None
    assert "renfe" in result.carrier.lower()


def test_parse_train_route():
    text = "Madrid -> Barcelona. Tren AVE. Salida 16/06/2024 07:00"
    result = parse_train(text)
    assert result.origin is not None
    assert result.destination is not None


# ─────────────────────────────────────────────────────────────────────────────
# Tests de ICS
# ─────────────────────────────────────────────────────────────────────────────

def test_parse_ics_flight():
    result = parse_ics(SAMPLE_ICS.decode())
    assert result.leg_type == "flight"
    assert result.source_format == "ics"
    assert result.confidence >= 0.7


def test_parse_ics_flight_number():
    result = parse_ics(SAMPLE_ICS.decode())
    assert result.flight_number == "IB6827"


def test_parse_ics_flight_route():
    result = parse_ics(SAMPLE_ICS.decode())
    assert result.origin == "MAD"
    assert result.destination == "BCN"


def test_parse_ics_flight_dates():
    result = parse_ics(SAMPLE_ICS.decode())
    assert result.departure_local is not None
    assert result.arrival_local is not None


def test_parse_ics_locator():
    result = parse_ics(SAMPLE_ICS.decode())
    assert result.locator_code is not None


def test_parse_ics_invalid():
    result = parse_ics("NOT AN ICS FILE")
    assert result.leg_type == "unknown"
    assert result.confidence == 0.0


# ─────────────────────────────────────────────────────────────────────────────
# Tests de parse_travel_email (raw bytes)
# ─────────────────────────────────────────────────────────────────────────────

def test_parse_flight_email_en():
    result = parse_travel_email(SAMPLE_FLIGHT_EMAIL_EN)
    assert result.leg_type == "flight"
    assert result.flight_number == "IB6827"
    assert result.origin == "MAD"
    assert result.destination == "BCN"
    assert result.locator_code == "ABC123"
    assert result.confidence >= 0.6


def test_parse_hotel_email_es():
    result = parse_travel_email(SAMPLE_HOTEL_EMAIL_ES)
    assert result.leg_type == "hotel"
    assert "Central" in (result.accommodation_name or "")
    assert result.confidence >= 0.4


def test_parse_train_email_es():
    result = parse_travel_email(SAMPLE_TRAIN_EMAIL_ES)
    assert result.leg_type == "train"
    assert result.confidence >= 0.3


def test_parse_ics_email_via_raw():
    """ICS como adjunto en email raw tiene prioridad sobre texto plano."""
    ics_email = (
        b"From: airline@example.com\r\n"
        b"Content-Type: multipart/mixed; boundary=boundary\r\n\r\n"
        b"--boundary\r\n"
        b"Content-Type: text/plain\r\n\r\n"
        b"Your flight is confirmed.\r\n"
        b"--boundary\r\n"
        b"Content-Type: text/calendar\r\n\r\n"
        + SAMPLE_ICS +
        b"\r\n--boundary--\r\n"
    )
    result = parse_travel_email(ics_email)
    assert result.source_format == "ics"
    assert result.leg_type == "flight"
    assert result.confidence >= 0.7


def test_unknown_email_returns_empty_leg():
    result = parse_travel_email(GARBAGE_EMAIL)
    assert result.leg_type == "unknown"
    assert result.confidence < 0.2
    assert result.confirmed is False
    assert result.parser_notes is not None


# ─────────────────────────────────────────────────────────────────────────────
# Tests de parse_travel_email_text (desde texto ya extraído)
# ─────────────────────────────────────────────────────────────────────────────

def test_parse_text_flight():
    text = "Flight IB6827 from MAD to BCN. Departure 15/06/2024 20:30. Ref: ABC123"
    result = parse_travel_email_text(text)
    assert result.leg_type == "flight"
    assert result.confidence >= 0.4


def test_parse_text_with_ics_priority():
    """Cuando se pasa ics_content, tiene prioridad sobre text."""
    text = "This is a hotel booking confirmation."
    ics_content = SAMPLE_ICS.decode()
    result = parse_travel_email_text(text, ics_content=ics_content)
    # ICS detecta vuelo → debe ganar sobre texto que dice hotel
    assert result.source_format == "ics"
    assert result.leg_type == "flight"


def test_parse_text_empty():
    result = parse_travel_email_text("")
    assert result.leg_type == "unknown"
    assert result.confirmed is False


def test_confirmed_always_false():
    """Los tramos creados por parser siempre tienen confirmed=False."""
    for raw in [SAMPLE_FLIGHT_EMAIL_EN, SAMPLE_HOTEL_EMAIL_ES, SAMPLE_TRAIN_EMAIL_ES]:
        result = parse_travel_email(raw)
        assert result.confirmed is False, f"confirmed debe ser False para {result.leg_type}"
