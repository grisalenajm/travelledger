"""add indexes for common query paths (expenses, trip_legs, trips)

Revision ID: 0022
Revises: 0021
Create Date: 2026-06-10 00:00:00.000000

Las FKs en PostgreSQL no crean índices automáticamente. Sin estos índices,
listados de gastos, stats y legs hacen sequential scan en cada request.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_expenses_trip_id", "expenses", ["trip_id"])
    op.create_index("ix_expenses_user_id_date", "expenses", ["user_id", "date"])
    op.create_index("ix_trip_legs_trip_id", "trip_legs", ["trip_id"])
    op.create_index("ix_trip_legs_user_id", "trip_legs", ["user_id"])
    op.create_index("ix_trips_user_id_status", "trips", ["user_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_trips_user_id_status", table_name="trips")
    op.drop_index("ix_trip_legs_user_id", table_name="trip_legs")
    op.drop_index("ix_trip_legs_trip_id", table_name="trip_legs")
    op.drop_index("ix_expenses_user_id_date", table_name="expenses")
    op.drop_index("ix_expenses_trip_id", table_name="expenses")
