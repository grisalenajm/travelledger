"""add_expense_draft_and_ocr_fields

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-29 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("expenses", sa.Column("is_draft", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("expenses", sa.Column("ocr_raw", sa.Text(), nullable=True))
    op.add_column("expenses", sa.Column("ocr_confidence", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("expenses", "ocr_confidence")
    op.drop_column("expenses", "ocr_raw")
    op.drop_column("expenses", "is_draft")
