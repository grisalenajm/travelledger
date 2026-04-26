import type { Expense } from "@/types/index"
import { Badge } from "@/components/ui/badge"

const CATEGORY_EMOJI: Record<Expense["category"], string> = {
  Dining: "🍽️",
  Lodging: "🏨",
  Transport: "✈️",
  Culture: "🎭",
  Shopping: "🛍️",
  Health: "💊",
  Other: "📌",
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  })
}

interface ExpenseCardProps {
  expense: Expense
  currencyBase: string
}

export function ExpenseCard({ expense, currencyBase }: ExpenseCardProps) {
  const showBase = expense.currency !== currencyBase

  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-container-lowest px-4 py-3 shadow-editorial">
      <span className="text-2xl leading-none select-none" aria-hidden="true">
        {CATEGORY_EMOJI[expense.category]}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-on-surface truncate">
          {expense.description || expense.category}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-xs text-on-surface-variant">{fmtDate(expense.date)}</span>
          {!expense.billable && <Badge variant="warning">personal</Badge>}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-on-surface">
          {Number(expense.amount).toFixed(2)} {expense.currency}
        </p>
        {showBase && (
          <p className="text-xs text-on-surface-variant">
            {Number(expense.amount_base).toFixed(2)} {currencyBase}
          </p>
        )}
      </div>
    </div>
  )
}
