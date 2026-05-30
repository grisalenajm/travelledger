"""add invite fields to users

Revision ID: 0017
Revises: 0014
Create Date: 2026-05-21

NOTA: is_active ya existe en la BD (añadida por 0015 rolled-back).
      Solo se añaden los campos nuevos de invitación.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("invite_token", sa.String(128), nullable=True))
    op.add_column("users", sa.Column("invite_token_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("invited_by", sa.UUID(), nullable=True))
    op.create_unique_constraint("uq_users_invite_token", "users", ["invite_token"])
    op.create_foreign_key(
        "fk_users_invited_by",
        "users", "users",
        ["invited_by"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_invited_by", "users", type_="foreignkey")
    op.drop_constraint("uq_users_invite_token", "users", type_="unique")
    op.drop_column("users", "invited_by")
    op.drop_column("users", "must_change_password")
    op.drop_column("users", "invite_token_expires_at")
    op.drop_column("users", "invite_token")
