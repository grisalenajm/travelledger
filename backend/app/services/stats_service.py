import logging
from collections import defaultdict
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.models.trip import Trip
from app.models.trip_leg import TripLeg
from app.models.user import User
from app.services.trip_service import get_or_404 as get_trip_or_404

logger = logging.getLogger(__name__)


async def get_trip_stats(db: AsyncSession, trip_id: UUID, user: User, *, effective_user_id: UUID | None = None) -> dict:
    uid = effective_user_id if effective_user_id is not None else user.id
    trip = await get_trip_or_404(db, trip_id, uid)

    result = await db.execute(
        select(Expense).where(
            Expense.trip_id == trip_id,
            Expense.is_draft == False,  # noqa: E712
        )
    )
    expenses = list(result.scalars().all())

    total_base = sum(float(e.amount_base) for e in expenses)
    expense_count = len(expenses)
    duration_days = (trip.end_date - trip.start_date).days + 1
    avg_per_day = round(total_base / duration_days, 2) if duration_days > 0 else 0.0
    budget_base = float(trip.budget)
    budget_pct = round(min(total_base / budget_base * 100, 100), 1) if budget_base > 0 else 0.0

    cat_acc: dict[str, dict] = defaultdict(lambda: {"total": 0.0, "count": 0})
    for e in expenses:
        cat_acc[e.category]["total"] += float(e.amount_base)
        cat_acc[e.category]["count"] += 1
    by_category = sorted(
        [
            {
                "category": k,
                "total": round(v["total"], 2),
                "count": v["count"],
                "pct": round(v["total"] / total_base * 100, 1) if total_base > 0 else 0.0,
            }
            for k, v in cat_acc.items()
        ],
        key=lambda x: -x["total"],
    )

    day_acc: dict[str, float] = defaultdict(float)
    for e in expenses:
        day_acc[str(e.date)] += float(e.amount_base)
    by_day = [
        {"date": d, "total": round(t, 2)}
        for d, t in sorted(day_acc.items())
    ]

    pay_acc: dict[str, dict] = defaultdict(lambda: {"total": 0.0, "count": 0})
    for e in expenses:
        method = str(e.payment_method_id) if e.payment_method_id else "other"
        pay_acc[method]["total"] += float(e.amount_base)
        pay_acc[method]["count"] += 1
    by_payment = sorted(
        [
            {"method": k, "total": round(v["total"], 2), "count": v["count"]}
            for k, v in pay_acc.items()
        ],
        key=lambda x: -x["total"],
    )

    merchant_acc: dict[str, dict] = defaultdict(lambda: {"total": 0.0, "count": 0})
    for e in expenses:
        name = (e.description or "").strip() or "Sin descripción"
        merchant_acc[name]["total"] += float(e.amount_base)
        merchant_acc[name]["count"] += 1
    top_merchants = sorted(
        [
            {"name": k, "total": round(v["total"], 2), "count": v["count"]}
            for k, v in merchant_acc.items()
        ],
        key=lambda x: -x["total"],
    )[:5]

    return {
        "trip_id": str(trip_id),
        "currency_base": user.currency_base,
        "total_base": round(total_base, 2),
        "expense_count": expense_count,
        "duration_days": duration_days,
        "avg_per_day": avg_per_day,
        "budget_base": budget_base,
        "budget_pct": budget_pct,
        "by_category": by_category,
        "by_day": by_day,
        "by_payment": by_payment,
        "top_merchants": top_merchants,
    }


async def get_global_stats(db: AsyncSession, user: User, period: str, year: int, *, effective_user_id: UUID | None = None) -> dict:
    uid = effective_user_id if effective_user_id is not None else user.id
    result = await db.execute(
        select(Expense)
        .join(Trip, Expense.trip_id == Trip.id)
        .where(Trip.user_id == uid, Expense.is_draft == False)  # noqa: E712
    )
    all_expenses = list(result.scalars().all())
    expenses = [e for e in all_expenses if e.date.year == year]

    trip_ids = list({e.trip_id for e in expenses})
    trips_result = await db.execute(select(Trip).where(Trip.id.in_(trip_ids)))
    trips_map: dict[UUID, Trip] = {t.id: t for t in trips_result.scalars().all()}

    total_base = sum(float(e.amount_base) for e in expenses)
    expense_count = len(expenses)
    trip_count = len(trip_ids)

    cat_acc: dict[str, dict] = defaultdict(lambda: {"total": 0.0, "count": 0})
    for e in expenses:
        cat_acc[e.category]["total"] += float(e.amount_base)
        cat_acc[e.category]["count"] += 1
    by_category = sorted(
        [
            {
                "category": k,
                "total": round(v["total"], 2),
                "count": v["count"],
                "pct": round(v["total"] / total_base * 100, 1) if total_base > 0 else 0.0,
            }
            for k, v in cat_acc.items()
        ],
        key=lambda x: -x["total"],
    )

    pay_acc: dict[str, dict] = defaultdict(lambda: {"total": 0.0, "count": 0})
    for e in expenses:
        method = str(e.payment_method_id) if e.payment_method_id else "other"
        pay_acc[method]["total"] += float(e.amount_base)
        pay_acc[method]["count"] += 1
    by_payment = sorted(
        [{"method": k, "total": round(v["total"], 2), "count": v["count"]} for k, v in pay_acc.items()],
        key=lambda x: -x["total"],
    )

    month_acc: dict[str, float] = defaultdict(float)
    for e in expenses:
        month_acc[str(e.date)[:7]] += float(e.amount_base)
    by_month = [{"month": m, "total": round(t, 2)} for m, t in sorted(month_acc.items())]

    trip_acc: dict[str, dict] = defaultdict(lambda: {"total": 0.0, "count": 0})
    for e in expenses:
        trip_acc[str(e.trip_id)]["total"] += float(e.amount_base)
        trip_acc[str(e.trip_id)]["count"] += 1
    by_trip = sorted(
        [
            {
                "trip_id": k,
                "trip_name": trips_map[UUID(k)].name if UUID(k) in trips_map else "Unknown",
                "destination": trips_map[UUID(k)].destination if UUID(k) in trips_map else "",
                "total": round(v["total"], 2),
                "expense_count": v["count"],
            }
            for k, v in trip_acc.items()
        ],
        key=lambda x: -x["total"],
    )

    merchant_acc: dict[str, dict] = defaultdict(lambda: {"total": 0.0, "count": 0})
    for e in expenses:
        name = (e.description or "").strip() or "Sin descripción"
        merchant_acc[name]["total"] += float(e.amount_base)
        merchant_acc[name]["count"] += 1
    top_merchants = sorted(
        [{"name": k, "total": round(v["total"], 2), "count": v["count"]} for k, v in merchant_acc.items()],
        key=lambda x: -x["total"],
    )[:5]

    return {
        "currency_base": user.currency_base,
        "year": year,
        "period": period,
        "total_base": round(total_base, 2),
        "expense_count": expense_count,
        "trip_count": trip_count,
        "by_category": by_category,
        "by_payment": by_payment,
        "by_month": by_month,
        "by_trip": by_trip,
        "top_merchants": top_merchants,
    }


async def get_flight_stats(db: AsyncSession, user: User, period: str, year: int, *, effective_user_id: UUID | None = None) -> dict:
    uid = effective_user_id if effective_user_id is not None else user.id
    trips_result = await db.execute(select(Trip).where(Trip.user_id == uid))
    trips_map: dict[UUID, Trip] = {t.id: t for t in trips_result.scalars().all()}
    trip_ids_in_year = {tid for tid, t in trips_map.items() if t.start_date.year == year}

    legs_result = await db.execute(
        select(TripLeg)
        .join(Trip, TripLeg.trip_id == Trip.id)
        .where(Trip.user_id == uid, TripLeg.mode == "flight")
    )
    all_legs = list(legs_result.scalars().all())
    legs = [leg for leg in all_legs if leg.trip_id in trip_ids_in_year]

    total_flights = len(legs)
    total_km = round(sum(float(leg.distance_km) for leg in legs if leg.distance_km is not None), 0)
    avg_km = round(total_km / total_flights, 0) if total_flights > 0 else 0.0

    carrier_acc: dict[str, dict] = defaultdict(lambda: {"flights": 0, "km": 0.0})
    for leg in legs:
        c = leg.carrier or "Desconocida"
        carrier_acc[c]["flights"] += 1
        if leg.distance_km:
            carrier_acc[c]["km"] += float(leg.distance_km)
    by_carrier = sorted(
        [{"carrier": k, "flights": v["flights"], "km": round(v["km"], 0)} for k, v in carrier_acc.items()],
        key=lambda x: -x["flights"],
    )

    route_acc: dict[str, dict] = defaultdict(lambda: {"flights": 0, "km": 0.0})
    for leg in legs:
        o = leg.origin or "?"
        d = leg.destination or "?"
        key = f"{o}→{d}"
        route_acc[key]["flights"] += 1
        if leg.distance_km:
            route_acc[key]["km"] += float(leg.distance_km)
    top_routes = sorted(
        [{"route": k, "flights": v["flights"], "km": round(v["km"], 0)} for k, v in route_acc.items()],
        key=lambda x: -x["flights"],
    )[:5]

    return {
        "year": year,
        "period": period,
        "total_flights": total_flights,
        "total_km": total_km,
        "avg_km_per_flight": avg_km,
        "by_carrier": by_carrier,
        "top_routes": top_routes,
    }
