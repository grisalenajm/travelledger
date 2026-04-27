import uuid
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.setting import Setting


async def get_all(db: AsyncSession, user_id: UUID) -> dict[str, str | None]:
    result = await db.execute(select(Setting).where(Setting.user_id == user_id))
    return {row.key: row.value for row in result.scalars().all()}


async def get(db: AsyncSession, user_id: UUID, key: str) -> str | None:
    result = await db.execute(
        select(Setting).where(Setting.user_id == user_id, Setting.key == key)
    )
    row = result.scalar_one_or_none()
    return row.value if row else None


async def set(db: AsyncSession, user_id: UUID, key: str, value: str | None) -> None:
    stmt = (
        pg_insert(Setting)
        .values(id=uuid.uuid4(), user_id=user_id, key=key, value=value)
        .on_conflict_do_update(
            constraint="uq_user_setting",
            set_={"value": value},
        )
    )
    await db.execute(stmt)
