"""add_location_to_expense

Revision ID: 0010
Revises: 0009
Create Date: 2026-05-15 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("expenses", sa.Column("location_lat", sa.Numeric(9, 6), nullable=True))
    op.add_column("expenses", sa.Column("location_lng", sa.Numeric(9, 6), nullable=True))
    op.add_column("expenses", sa.Column("location_name", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("expenses", "location_name")
    op.drop_column("expenses", "location_lng")
    op.drop_column("expenses", "location_lat")
