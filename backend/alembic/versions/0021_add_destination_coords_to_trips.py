"""add destination coords to trips

Revision ID: 0021
Revises: 0020
Create Date: 2026-06-06 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("trips", sa.Column("destination_lat", sa.Numeric(9, 6), nullable=True))
    op.add_column("trips", sa.Column("destination_lng", sa.Numeric(9, 6), nullable=True))


def downgrade() -> None:
    op.drop_column("trips", "destination_lng")
    op.drop_column("trips", "destination_lat")
