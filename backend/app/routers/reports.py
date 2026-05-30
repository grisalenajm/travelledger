from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession


from app.core.dependencies import get_current_user, get_effective_user_id
from app.database import get_db
from app.models.user import User
from app.services import expense_service, export_service, loyalty_card_service
from app.services.trip_service import get_or_404 as get_trip_or_404

router = APIRouter(prefix="/api/reports", tags=["reports"], redirect_slashes=False)


@router.get("/trip/{trip_id}")
async def get_trip_summary(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    effective_id: UUID = Depends(get_effective_user_id),
):
    trip = await get_trip_or_404(db, trip_id, effective_id)
    expenses = await expense_service.list_expenses(db, effective_id, trip_id=trip_id)

    by_category: dict[str, dict] = {}
    for exp in expenses:
        cat = exp.category
        if cat not in by_category:
            by_category[cat] = {"amount_base": 0.0, "count": 0}
        by_category[cat]["amount_base"] += float(exp.amount_base)
        by_category[cat]["count"] += 1

    total_base = sum(float(e.amount_base) for e in expenses)

    by_currency: dict[str, dict] = {}
    for exp in expenses:
        cur = exp.currency
        if cur not in by_currency:
            by_currency[cur] = {"amount": 0.0, "amount_base": 0.0}
        by_currency[cur]["amount"] += float(exp.amount)
        by_currency[cur]["amount_base"] += float(exp.amount_base)

    return {
        "trip_id": str(trip_id),
        "trip_name": trip.name,
        "base_currency": current_user.currency_base,
        "total_base": total_base,
        "total_billable": sum(float(e.amount_base) for e in expenses if e.billable),
        "total_personal": sum(float(e.amount_base) for e in expenses if not e.billable),
        "by_category": [
            {
                "category": cat,
                "amount_base": data["amount_base"],
                "count": data["count"],
                "percentage": (data["amount_base"] / total_base) if total_base > 0 else 0.0,
            }
            for cat, data in sorted(
                by_category.items(), key=lambda x: x[1]["amount_base"], reverse=True
            )
        ],
        "by_currency": [
            {"currency": cur, **data}
            for cur, data in by_currency.items()
        ],
    }


@router.get("/export/{trip_id}")
async def export_trip(
    trip_id: UUID,
    format: str = Query("csv"),
    only_billable: bool = Query(False),
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    effective_id: UUID = Depends(get_effective_user_id),
):
    trip = await get_trip_or_404(db, trip_id, effective_id)
    expenses = await expense_service.list_expenses(
        db,
        effective_id,
        trip_id=trip_id,
        billable=True if only_billable else None,
        date_from=str(from_date) if from_date else None,
        date_to=str(to_date) if to_date else None,
    )
    cards = await loyalty_card_service.list_cards(db, effective_id)
    loyalty_map = {str(c.id): (c.alias or c.program_name) for c in cards}

    csv_bytes = await export_service.build_csv(db, trip, current_user, expenses, loyalty_map)
    slug = export_service._slugify(trip.name)
    filename = f"gastos_{slug}_{date.today()}.csv"

    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/{trip_id}/bundle")
async def export_trip_bundle(
    trip_id: UUID,
    only_billable: bool = Query(False),
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    effective_id: UUID = Depends(get_effective_user_id),
):
    trip = await get_trip_or_404(db, trip_id, effective_id)
    expenses = await expense_service.list_expenses(
        db,
        effective_id,
        trip_id=trip_id,
        billable=True if only_billable else None,
        date_from=str(from_date) if from_date else None,
        date_to=str(to_date) if to_date else None,
    )
    cards = await loyalty_card_service.list_cards(db, effective_id)
    loyalty_map = {str(c.id): (c.alias or c.program_name) for c in cards}

    zip_bytes = await export_service.build_bundle(db, trip, current_user, expenses, loyalty_map)
    slug = export_service._slugify(trip.name)
    filename = f"bundle_{slug}_{date.today()}.zip"

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
