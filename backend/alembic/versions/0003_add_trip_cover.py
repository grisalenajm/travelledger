"""add_trip_cover

Revision ID: 0003
Revises: 34765b5418c8
Create Date: 2026-04-26

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "34765b5418c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("trips", sa.Column("cover_doc_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("trips", "cover_doc_id")
