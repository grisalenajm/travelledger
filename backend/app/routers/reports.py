import re
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.services import export_service
from app.services.trip_service import get_or_404 as get_trip_or_404

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/export/{trip_id}")
async def export_trip(
    trip_id: UUID,
    format: str = Query(default="csv"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if format != "csv":
        raise HTTPException(status_code=400, detail="Only format=csv is supported")

    trip = await get_trip_or_404(db, trip_id, user.id)
    csv_content = await export_service.trip_csv(db, trip_id, user)

    slug = re.sub(r"[^\w\-]", "_", trip.name)
    filename = f"gastos_{slug}_{date.today()}.csv"

    return StreamingResponse(
        iter([csv_content.encode("utf-8-sig")]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
