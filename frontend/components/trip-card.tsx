import Link from "next/link"
import type { Trip, TripSummary } from "@/types/index"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

const STATUS_CONFIG: Record<
  Trip["status"],
  { label: string; variant: "success" | "muted" | "warning" }
> = {
  active: { label: "Activo", variant: "success" },
  closed: { label: "Cerrado", variant: "muted" },
  draft: { label: "Borrador", variant: "warning" },
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

interface TripCardProps {
  trip: Trip
  summary?: TripSummary
}

export function TripCard({ trip, summary }: TripCardProps) {
  const { label, variant } = STATUS_CONFIG[trip.status]
  const overBudget = summary !== undefined && Number(summary.percentage) > 100

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group block rounded-xl bg-surface-container-lowest p-5 shadow-editorial transition-shadow hover:shadow-fab focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-headline text-base font-semibold text-on-surface truncate">
            {trip.name}
          </p>
          <p className="mt-0.5 text-sm text-on-surface-variant">{trip.destination}</p>
        </div>
        <Badge variant={variant}>{label}</Badge>
      </div>

      <p className="mt-2 text-xs text-on-surface-variant">
        {fmtDate(trip.start_date)} – {fmtDate(trip.end_date)}
      </p>

      {summary !== undefined && (
        <div className="mt-4 space-y-2">
          <Progress
            value={Number(summary.percentage)}
            indicatorClassName={overBudget ? "bg-error" : undefined}
          />
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>
              {Number(summary.spent_base).toFixed(2)} / {Number(summary.budget_base).toFixed(2)}{" "}
              {summary.currency_base}
            </span>
            <div className="flex gap-3">
              <span>{summary.expense_count} gastos</span>
              <span>{summary.legs_count} tramos</span>
            </div>
          </div>
        </div>
      )}
    </Link>
  )
}
