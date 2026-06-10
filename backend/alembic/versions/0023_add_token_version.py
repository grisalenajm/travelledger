"""add token_version to users for refresh token revocation

Revision ID: 0023
Revises: 0022
Create Date: 2026-06-10 00:00:00.000000

El refresh JWT lleva token_version en el claim "tv". En logout se incrementa
el campo, invalidando todos los refresh tokens emitidos para ese usuario.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0023"
down_revision: Union[str, None] = "0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_column("users", "token_version")
