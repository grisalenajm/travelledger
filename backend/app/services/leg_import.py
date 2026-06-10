"""Helpers compartidos para crear TripLegs desde emails (webhook + IMAP poller)."""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.trip_leg import TripLeg
from app.models.user import User
from app.services.travel_email_parser import TravelParseResult

LEG_TYPE_TO_MODE = {
    "flight":     "flight",
    "hotel":      "accommodation",
    "car_rental": "car_rental",
    "train":      "train",
    "unknown":    "other",
}


async def resolve_import_user(db: AsyncSession) -> User | None:
    """Usuario destino de las importaciones: WEBHOOK_USER_EMAIL o primer admin."""
    if settings.WEBHOOK_USER_EMAIL:
        result = await db.execute(
            select(User).where(User.email == settings.WEBHOOK_USER_EMAIL)
        )
        user = result.scalar_one_or_none()
        if user:
            return user
    result = await db.execute(
        select(User).where(User.is_admin.is_(True)).limit(1)
    )
    return result.scalar_one_or_none()


def leg_from_result(user_id: UUID, result: TravelParseResult) -> TripLeg:
    """Convierte TravelParseResult en TripLeg sin trip_id (pendiente de asignación)."""
    mode = LEG_TYPE_TO_MODE.get(result.leg_type, "other")
    leg = TripLeg(
        trip_id=None,
        user_id=user_id,
        mode=mode,
        source="email_import",
        confirmed=False,
        notes=result.parser_notes,
    )
    if result.leg_type in ("flight", "train"):
        leg.carrier = result.carrier
        leg.flight_number = result.flight_number
        leg.origin = result.origin
        leg.destination = result.destination
        leg.departure_local = result.departure_local
        leg.arrival_local = result.arrival_local
        leg.locator_code = result.locator_code
    elif result.leg_type == "hotel":
        leg.accommodation_name = result.accommodation_name
        leg.accommodation_address = result.accommodation_address
        leg.check_in = result.check_in
        leg.check_out = result.check_out
        leg.confirmation_number = result.confirmation_number
    elif result.leg_type == "car_rental":
        leg.rental_company = result.rental_company
        leg.pickup_location = result.pickup_location
        leg.dropoff_location = result.dropoff_location
        leg.pickup_datetime = result.pickup_datetime
        leg.dropoff_datetime = result.dropoff_datetime
        leg.confirmation_number = result.confirmation_number
    return leg
