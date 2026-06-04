"""clean NaN values in location_lat/location_lng

Revision ID: 0020
Revises: 0019
Create Date: 2026-06-04 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        UPDATE expenses
        SET location_lat = NULL, location_lng = NULL
        WHERE location_lat = 'NaN'::numeric
           OR location_lng = 'NaN'::numeric
    """)


def downgrade() -> None:
    pass
