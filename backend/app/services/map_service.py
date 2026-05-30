import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.models.trip_leg import TripLeg
from app.schemas.map import MapExpense, MapLeg, MapLegPoint, TripMapData
from app.services.trip_service import get_or_404 as get_trip_or_404

logger = logging.getLogger(__name__)


async def get_map_data(db: AsyncSession, trip_id: UUID, user_id: UUID) -> TripMapData:
    await get_trip_or_404(db, trip_id, user_id)

    result = await db.execute(
        select(Expense).where(
            Expense.trip_id == trip_id,
            Expense.user_id == user_id,
            Expense.location_lat.is_not(None),
            Expense.location_lng.is_not(None),
        )
    )
    expenses = result.scalars().all()
    map_expenses = [
        MapExpense(
            id=e.id,
            description=e.description,
            amount=e.amount,
            currency=e.currency,
            category=e.category,
            date=e.date,
            location_lat=e.location_lat,  # type: ignore[arg-type]
            location_lng=e.location_lng,  # type: ignore[arg-type]
            location_name=e.location_name,
        )
        for e in expenses
    ]

    result = await db.execute(
        select(TripLeg).where(TripLeg.trip_id == trip_id)
    )
    legs = result.scalars().all()

    map_legs: list[MapLeg] = []
    for leg in legs:
        points = _extract_leg_points(leg)
        if points:
            map_legs.append(MapLeg(id=leg.id, mode=leg.mode, points=points))

    return TripMapData(expenses=map_expenses, legs=map_legs)


def _extract_leg_points(leg: TripLeg) -> list[MapLegPoint]:
    if leg.mode == "accommodation":
        if leg.accommodation_lat and leg.accommodation_lng:
            label = leg.accommodation_name or leg.accommodation_address or "Alojamiento"
            return [MapLegPoint(lat=leg.accommodation_lat, lng=leg.accommodation_lng, label=label)]
        return []

    if leg.mode == "car_rental":
        points = []
        if leg.pickup_lat and leg.pickup_lng:
            points.append(MapLegPoint(
                lat=leg.pickup_lat,
                lng=leg.pickup_lng,
                label=f"Recogida: {leg.pickup_location or leg.rental_company or 'Inicio'}",
            ))
        if leg.dropoff_lat and leg.dropoff_lng:
            points.append(MapLegPoint(
                lat=leg.dropoff_lat,
                lng=leg.dropoff_lng,
                label=f"Devolución: {leg.dropoff_location or 'Fin'}",
            ))
        return points

    # flight | train | bus | ferry | other
    points = []
    if leg.origin_lat and leg.origin_lng:
        points.append(MapLegPoint(
            lat=leg.origin_lat,
            lng=leg.origin_lng,
            label=leg.origin or "Origen",
        ))
    if leg.destination_lat and leg.destination_lng:
        points.append(MapLegPoint(
            lat=leg.destination_lat,
            lng=leg.destination_lng,
            label=leg.destination or "Destino",
        ))
    return points
