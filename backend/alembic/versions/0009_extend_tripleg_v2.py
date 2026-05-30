"""extend_tripleg_v2

Revision ID: 0009
Revises: 0008
Create Date: 2026-05-15 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # mode varchar(10) → varchar(20) para acomodar "accommodation" (13 chars)
    op.alter_column("trip_legs", "mode", type_=sa.String(20), existing_nullable=False)

    # origin/destination/departure/arrival pasan a nullable: no aplican en alojamiento
    op.alter_column("trip_legs", "origin", existing_type=sa.String(100), nullable=True)
    op.alter_column("trip_legs", "destination", existing_type=sa.String(100), nullable=True)
    op.alter_column("trip_legs", "departure_local", existing_type=sa.DateTime(timezone=False), nullable=True)
    op.alter_column("trip_legs", "arrival_local", existing_type=sa.DateTime(timezone=False), nullable=True)

    # ── Comunes ──────────────────────────────────────────────────────────────
    op.add_column("trip_legs", sa.Column("document_path", sa.Text(), nullable=True))
    op.add_column("trip_legs", sa.Column("expense_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_trip_legs_expense_id",
        "trip_legs", "expenses",
        ["expense_id"], ["id"],
        ondelete="SET NULL",
    )

    # ── Transporte: coords + vuelo ────────────────────────────────────────────
    op.add_column("trip_legs", sa.Column("origin_lat", sa.Numeric(9, 6), nullable=True))
    op.add_column("trip_legs", sa.Column("origin_lng", sa.Numeric(9, 6), nullable=True))
    op.add_column("trip_legs", sa.Column("destination_lat", sa.Numeric(9, 6), nullable=True))
    op.add_column("trip_legs", sa.Column("destination_lng", sa.Numeric(9, 6), nullable=True))
    op.add_column("trip_legs", sa.Column("flight_number", sa.String(20), nullable=True))
    op.add_column("trip_legs", sa.Column("seat", sa.String(10), nullable=True))
    op.add_column("trip_legs", sa.Column("distance_km", sa.Numeric(10, 2), nullable=True))

    # ── Alojamiento ───────────────────────────────────────────────────────────
    op.add_column("trip_legs", sa.Column("accommodation_name", sa.String(200), nullable=True))
    op.add_column("trip_legs", sa.Column("accommodation_address", sa.Text(), nullable=True))
    op.add_column("trip_legs", sa.Column("accommodation_lat", sa.Numeric(9, 6), nullable=True))
    op.add_column("trip_legs", sa.Column("accommodation_lng", sa.Numeric(9, 6), nullable=True))
    op.add_column("trip_legs", sa.Column("accommodation_provider", sa.String(100), nullable=True))
    op.add_column("trip_legs", sa.Column("check_in", sa.DateTime(timezone=False), nullable=True))
    op.add_column("trip_legs", sa.Column("check_out", sa.DateTime(timezone=False), nullable=True))

    # ── Alquiler de coche ─────────────────────────────────────────────────────
    op.add_column("trip_legs", sa.Column("rental_company", sa.String(100), nullable=True))
    op.add_column("trip_legs", sa.Column("pickup_location", sa.String(200), nullable=True))
    op.add_column("trip_legs", sa.Column("pickup_lat", sa.Numeric(9, 6), nullable=True))
    op.add_column("trip_legs", sa.Column("pickup_lng", sa.Numeric(9, 6), nullable=True))
    op.add_column("trip_legs", sa.Column("dropoff_location", sa.String(200), nullable=True))
    op.add_column("trip_legs", sa.Column("dropoff_lat", sa.Numeric(9, 6), nullable=True))
    op.add_column("trip_legs", sa.Column("dropoff_lng", sa.Numeric(9, 6), nullable=True))
    op.add_column("trip_legs", sa.Column("pickup_datetime", sa.DateTime(timezone=False), nullable=True))
    op.add_column("trip_legs", sa.Column("dropoff_datetime", sa.DateTime(timezone=False), nullable=True))
    op.add_column("trip_legs", sa.Column("confirmation_number", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_constraint("fk_trip_legs_expense_id", "trip_legs", type_="foreignkey")

    for col in [
        "confirmation_number", "dropoff_datetime", "pickup_datetime",
        "dropoff_lng", "dropoff_lat", "dropoff_location",
        "pickup_lng", "pickup_lat", "pickup_location", "rental_company",
        "check_out", "check_in", "accommodation_provider",
        "accommodation_lng", "accommodation_lat",
        "accommodation_address", "accommodation_name",
        "distance_km", "seat", "flight_number",
        "destination_lng", "destination_lat", "origin_lng", "origin_lat",
        "expense_id", "document_path",
    ]:
        op.drop_column("trip_legs", col)

    op.alter_column("trip_legs", "arrival_local", existing_type=sa.DateTime(timezone=False), nullable=False)
    op.alter_column("trip_legs", "departure_local", existing_type=sa.DateTime(timezone=False), nullable=False)
    op.alter_column("trip_legs", "destination", existing_type=sa.String(100), nullable=False)
    op.alter_column("trip_legs", "origin", existing_type=sa.String(100), nullable=False)
    op.alter_column("trip_legs", "mode", type_=sa.String(10), existing_nullable=False)
