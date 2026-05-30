"""
One-time script: creates guest@ledger.local linked to the first owner account.

Usage (inside the backend container):
    python scripts/create_guest_user.py

Or from the LXC host:
    docker compose exec backend python scripts/create_guest_user.py
"""

import asyncio
import sys
from uuid import UUID

from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Add parent dir to path so imports resolve when run as a script
sys.path.insert(0, "/app")

from app.database import async_session_maker
from app.models.user import User

GUEST_EMAIL = "guest@ledger.local"
GUEST_PASSWORD = "guest"
GUEST_NAME = "Invitado"

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def main() -> None:
    async with async_session_maker() as db:
        # Resolve owner: the only non-guest user (or the first admin)
        result = await db.execute(
            select(User)
            .where(User.is_guest.is_(False))
            .order_by(User.created_at.asc())
        )
        owner = result.scalars().first()
        if not owner:
            print("ERROR: no owner user found — register first, then run this script.")
            sys.exit(1)

        # Check if guest already exists
        existing = await db.execute(select(User).where(User.email == GUEST_EMAIL))
        guest = existing.scalars().first()

        if guest:
            # Update link in case owner UUID changed
            guest.guest_of = owner.id
            await db.commit()
            print(f"Guest already exists (id={guest.id}). Updated guest_of → {owner.id}.")
            return

        guest = User(
            email=GUEST_EMAIL,
            name=GUEST_NAME,
            password_hash=pwd_ctx.hash(GUEST_PASSWORD),
            currency_base=owner.currency_base,
            is_guest=True,
            guest_of=owner.id,
        )
        db.add(guest)
        await db.commit()
        await db.refresh(guest)
        print(f"Guest user created: {guest.email} (id={guest.id})")
        print(f"  → guest_of owner: {owner.email} (id={owner.id})")
        print(f"  → login with: {GUEST_EMAIL} / {GUEST_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(main())
