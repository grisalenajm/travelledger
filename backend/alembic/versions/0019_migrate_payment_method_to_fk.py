"""migrate payment_method string to payment_method_id FK

Revision ID: 0019
Revises: 0018
Create Date: 2026-06-03 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Migrar gastos cuyo string coincide con un payment_method del mismo usuario
    op.execute("""
        UPDATE expenses e
        SET payment_method_id = pm.id
        FROM payment_methods pm
        WHERE e.user_id = pm.user_id
          AND LOWER(e.payment_method) = LOWER(pm.name)
          AND e.payment_method_id IS NULL
          AND e.payment_method IS NOT NULL
    """)

    # 2. Para strings sin equivalente en payment_methods → crear el método primero
    op.execute("""
        INSERT INTO payment_methods (id, user_id, name, created_at)
        SELECT gen_random_uuid(), e.user_id, e.payment_method, NOW()
        FROM expenses e
        WHERE e.payment_method IS NOT NULL
          AND e.payment_method_id IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM payment_methods pm
              WHERE pm.user_id = e.user_id
                AND LOWER(pm.name) = LOWER(e.payment_method)
          )
        GROUP BY e.user_id, e.payment_method
    """)

    # 3. Segunda pasada para vincular los que quedaron sin FK
    op.execute("""
        UPDATE expenses e
        SET payment_method_id = pm.id
        FROM payment_methods pm
        WHERE e.user_id = pm.user_id
          AND LOWER(e.payment_method) = LOWER(pm.name)
          AND e.payment_method_id IS NULL
          AND e.payment_method IS NOT NULL
    """)

    # 4. DROP del campo legacy
    op.drop_column("expenses", "payment_method")


def downgrade() -> None:
    op.add_column("expenses", sa.Column("payment_method", sa.String(length=20), nullable=True))
