"""add_egencia_import

Revision ID: 0012
Revises: 0011
Create Date: 2026-05-17 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Nuevas columnas en trip_legs ────────────────────────────────────────
    op.add_column("trip_legs", sa.Column("source", sa.String(50), nullable=True))
    op.add_column(
        "trip_legs",
        sa.Column("confirmed", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    # ── Tabla notifications ─────────────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("data", sa.Text(), nullable=True),
        sa.Column(
            "read",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])

    # ── Tabla email_imports (deduplicación) ─────────────────────────────────
    op.create_table(
        "email_imports",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("message_id", sa.String(500), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column(
            "imported_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("legs_created", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("message_id", name="uq_email_imports_message_id"),
    )


def downgrade() -> None:
    op.drop_table("email_imports")
    op.drop_index("ix_notifications_user_id", "notifications")
    op.drop_table("notifications")
    op.drop_column("trip_legs", "confirmed")
    op.drop_column("trip_legs", "source")
