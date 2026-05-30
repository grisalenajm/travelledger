from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession


from app.core.dependencies import get_current_user, get_effective_user_id, require_not_guest
from app.database import get_db
from app.models.user import User
from app.schemas.notification import NotificationCount, NotificationRead
from app.services import notification_service

router = APIRouter(prefix="/api/notifications", tags=["notifications"], redirect_slashes=False)


@router.get("", response_model=list[NotificationRead])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    effective_id: UUID = Depends(get_effective_user_id),
):
    return await notification_service.list_notifications(db, effective_id)


@router.get("/count", response_model=NotificationCount)
async def count_unread(
    db: AsyncSession = Depends(get_db),
    effective_id: UUID = Depends(get_effective_user_id),
):
    unread = await notification_service.count_unread(db, effective_id)
    return NotificationCount(unread=unread)


@router.post("/read-all", response_model=NotificationCount)
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_not_guest),
):
    await notification_service.mark_all_read(db, user.id)
    return NotificationCount(unread=0)


@router.put("/{notification_id}/read", response_model=NotificationRead)
async def mark_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_not_guest),
):
    return await notification_service.mark_read(db, notification_id, user.id)
