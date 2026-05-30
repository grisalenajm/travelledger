"""imap_pending_legs

Revision ID: 0013
Revises: 0012
Create Date: 2026-05-17 00:00:00.000000

Permite legs sin trip_id (pendientes de asignación) para el flujo IMAP.
Solo ADD COLUMN y DROP NOT NULL — nunca DROP TABLE o DROP COLUMN.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Añadir user_id a trip_legs (nullable — backfill no requerido)
    op.add_column("trip_legs", sa.Column("user_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_trip_legs_user_id",
        "trip_legs", "users",
        ["user_id"], ["id"],
        ondelete="CASCADE",
    )
    # Hacer trip_id nullable para legs pendientes de asignación (IMAP import)
    op.alter_column("trip_legs", "trip_id", nullable=True)


def downgrade() -> None:
    # Restaurar NOT NULL (solo si no hay NULL values — usar con cuidado)
    op.alter_column("trip_legs", "trip_id", nullable=False)
    op.drop_constraint("fk_trip_legs_user_id", "trip_legs", type_="foreignkey")
    op.drop_column("trip_legs", "user_id")
