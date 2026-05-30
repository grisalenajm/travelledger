"""add guest mode to users

Revision ID: 0014
Revises: 0013
Create Date: 2026-05-20
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_guest", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("guest_of", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_users_guest_of",
        "users", "users",
        ["guest_of"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_guest_of", "users", type_="foreignkey")
    op.drop_column("users", "guest_of")
    op.drop_column("users", "is_guest")
