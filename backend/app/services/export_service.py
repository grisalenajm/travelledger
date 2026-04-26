import csv
import io
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services import expense_service


async def trip_csv(db: AsyncSession, trip_id: UUID, user: User) -> str:
    expenses = await expense_service.list_expenses(db, user.id, trip_id=trip_id)

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "date",
            "description",
            "category",
            "billable",
            "payment_method",
            "amount",
            "currency",
            "amount_base",
            "currency_base",
            "exchange_rate",
            "rate_date",
        ],
    )
    writer.writeheader()

    for expense in expenses:
        amount = float(expense.amount)
        amount_base = float(expense.amount_base)
        if expense.currency.upper() == user.currency_base.upper() or amount == 0:
            rate = "1"
        else:
            rate = f"{amount_base / amount:.6f}"

        writer.writerow(
            {
                "date": str(expense.date),
                "description": expense.description or "",
                "category": expense.category,
                "billable": "true" if expense.billable else "false",
                "payment_method": expense.payment_method or "",
                "amount": str(expense.amount),
                "currency": expense.currency,
                "amount_base": str(expense.amount_base),
                "currency_base": user.currency_base,
                "exchange_rate": rate,
                "rate_date": str(expense.rate_date),
            }
        )

    return output.getvalue()
