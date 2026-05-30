"""add_cover_image_path_to_trips

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-10 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("trips", sa.Column("cover_image_path", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("trips", "cover_image_path")
