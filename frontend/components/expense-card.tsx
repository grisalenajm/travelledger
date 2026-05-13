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
  onNavigate?: () => void
}

export function ExpenseCard({ expense, currencyBase, onNavigate }: ExpenseCardProps) {
  const showBase = expense.currency !== currencyBase

  return (
    <div
      className="flex items-center gap-3 rounded-xl bg-surface-container-lowest px-4 py-3 shadow-editorial cursor-pointer select-none active:scale-95 active:opacity-80 transition-all duration-150"
      style={{ WebkitTapHighlightColor: "transparent" }}
      onTouchStart={() => {}}
      onClick={onNavigate}
    >
      <span className="text-2xl leading-none select-none" aria-hidden="true">
        {CATEGORY_EMOJI[expense.category]}
      </span>

      <div className="min-w-0 flex-1">
        {expense.is_draft && (
          <span className="inline-flex items-center gap-1 bg-tertiary-fixed text-tertiary
                           px-2 py-0.5 rounded-full text-[10px] font-bold uppercase
                           tracking-wider mb-1">
            <span className="material-symbols-outlined text-[10px]">pending</span>
            Pendiente
          </span>
        )}
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
