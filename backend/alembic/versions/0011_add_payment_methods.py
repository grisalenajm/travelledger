"""add_payment_methods

Revision ID: 0011
Revises: 0010
Create Date: 2026-05-15 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "payment_methods",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.add_column(
        "expenses",
        sa.Column("payment_method_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_expenses_payment_method_id",
        "expenses",
        "payment_methods",
        ["payment_method_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_expenses_payment_method_id", "expenses", type_="foreignkey")
    op.drop_column("expenses", "payment_method_id")
    op.drop_table("payment_methods")
