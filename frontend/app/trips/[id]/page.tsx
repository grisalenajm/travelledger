"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useTrip, useTripSummary, useUpdateTrip } from "@/hooks/use-trips"
import { StatusChip } from "@/components/trip-card"
import { useExpenses } from "@/hooks/use-expenses"
import { ExpenseCard } from "@/components/expense-card"
import { AddExpenseModal } from "@/components/add-expense-modal"
import { ExportModal } from "@/components/export-modal"
import { Button } from "@/components/ui/button"
import { useTripLegs } from "@/hooks/use-trip-legs"
import { useTripStats } from "@/hooks/use-trip-stats"
import { useIsGuest } from "@/hooks/use-is-guest"
import type { TripLeg, TripStats, TripSummary } from "@/types/index"

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

function getTripDays(startDate: string, endDate: string): string[] {
  const days: string[] = []
  const [sy, sm, sd] = startDate.split("-").map(Number)
  const [ey, em, ed] = endDate.split("-").map(Number)
  const current = new Date(sy, sm - 1, sd)
  const end = new Date(ey, em - 1, ed)
  while (current <= end) {
    const y = current.getFullYear()
    const m = String(current.getMonth() + 1).padStart(2, "0")
    const d = String(current.getDate()).padStart(2, "0")
    days.push(`${y}-${m}-${d}`)
    current.setDate(current.getDate() + 1)
  }
  return days
}

function fmtChipDay(isoDate: string): string {
  const [, m, d] = isoDate.split("-").map(Number)
  return `${d} ${MONTHS_SHORT[m - 1]}`
}

function fmtAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// Slices "2026-05-15T23:55:00" → "23:55" without timezone conversion
function fmtTime(dt: string | null): string {
  if (!dt) return ""
  return dt.substring(11, 16)
}

function fmtShortDate(dt: string | null): string {
  if (!dt) return ""
  const [, m, d] = dt.substring(0, 10).split("-").map(Number)
  return `${d} ${MONTHS_SHORT[m - 1]}`
}

const LEG_ICONS: Record<string, string> = {
  flight: "flight",
  train: "train",
  bus: "directions_bus",
  ferry: "directions_boat",
  accommodation: "hotel",
  car_rental: "car_rental",
  other: "luggage",
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BudgetCard({ summary, stats }: { summary: TripSummary | undefined; stats: TripStats | undefined }) {
  if (!summary) return null

  const { spent_base, budget_base, currency_base, percentage } = summary
  const avgPerDay = stats?.avg_per_day
  const pct = Math.min(percentage, 100)
  const overBudget = percentage > 100

  return (
    <div className="rounded-xl bg-surface-container-lowest p-4 shadow-editorial">
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Gasto total
          </span>
          <p className="font-headline text-2xl font-bold text-on-surface mt-0.5">
            {fmtAmount(spent_base, currency_base)}
          </p>
        </div>
        {avgPerDay !== undefined && (
          <div className="text-right">
            <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Media / día
            </span>
            <p className="font-headline text-base font-semibold text-on-surface mt-0.5">
              {fmtAmount(avgPerDay, currency_base)}
            </p>
          </div>
        )}
      </div>

      {budget_base > 0 && (
        <>
          <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden mb-1.5">
            <div
              className={`h-full rounded-full transition-all ${overBudget ? "bg-error" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-on-surface-variant">
              de {fmtAmount(budget_base, currency_base)}
            </span>
            <span className={`text-xs font-semibold ${overBudget ? "text-error" : "text-primary"}`}>
              {Math.round(percentage)}%
            </span>
          </div>
        </>
      )}
    </div>
  )
}

function LegPreviewItem({ leg }: { leg: TripLeg }) {
  const icon = LEG_ICONS[leg.mode] ?? "luggage"

  let primary = ""
  let secondary = ""

  if (leg.mode === "accommodation") {
    primary = leg.accommodation_name ?? "Alojamiento"
    const ci = fmtShortDate(leg.check_in)
    const co = fmtShortDate(leg.check_out)
    secondary = [ci && `Entrada: ${ci}`, co && `Salida: ${co}`].filter(Boolean).join(" · ")
  } else if (leg.mode === "car_rental") {
    primary = [leg.rental_company, leg.pickup_location].filter(Boolean).join(" · ") || "Alquiler de coche"
    const pu = fmtShortDate(leg.pickup_datetime)
    const dr = fmtShortDate(leg.dropoff_datetime)
    secondary = [pu, dr].filter(Boolean).join(" → ")
  } else {
    primary = [leg.origin, leg.destination].filter(Boolean).join(" → ") || "Tramo"
    const dep = fmtTime(leg.departure_local)
    const arr = fmtTime(leg.arrival_local)
    const times = [dep, arr].filter(Boolean).join(" → ")
    const carrier = [leg.carrier, leg.flight_number].filter(Boolean).join(" ")
    secondary = [carrier, times].filter(Boolean).join(" · ")
  }

  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-container-lowest px-4 py-3 shadow-editorial">
      <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-primary text-[18px] leading-none">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-on-surface truncate">{primary}</p>
        {secondary && (
          <p className="text-xs text-on-surface-variant mt-0.5 truncate">{secondary}</p>
        )}
      </div>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 bg-surface-container-high rounded w-56" />
        <div className="h-4 bg-surface-container rounded w-40" />
      </div>
      <div className="h-24 bg-surface-container-high rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 bg-surface-container rounded-xl" />
        <div className="h-20 bg-surface-container rounded-xl" />
      </div>
      <div className="flex gap-2">
        <div className="h-7 bg-surface-container-high rounded-full w-8" />
        <div className="h-7 bg-surface-container rounded-full w-16" />
        <div className="h-7 bg-surface-container rounded-full w-16" />
        <div className="h-7 bg-surface-container rounded-full w-16" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl bg-surface-container-lowest px-4 py-3 shadow-editorial flex gap-3 items-center"
          >
            <div className="h-8 w-8 bg-surface-container-high rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-surface-container-high rounded w-3/4" />
              <div className="h-3 bg-surface-container rounded w-1/3" />
            </div>
            <div className="h-4 bg-surface-container-high rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const handleCloseExpenseModal = useCallback(() => setAddExpenseOpen(false), [])

  const { data: trip, isLoading: tripLoading, isError } = useTrip(id)
  const { data: summary } = useTripSummary(id)
  const { data: expenses, isLoading: expensesLoading } = useExpenses(id)
  const { data: legs } = useTripLegs(id)
  const { data: stats } = useTripStats(id)
  const updateTrip = useUpdateTrip()
  const isGuest = useIsGuest()

  if (tripLoading) {
    return (
      <main className="min-h-screen bg-background">
        <PageSkeleton />
      </main>
    )
  }

  if (isError || !trip) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-4 block">
            error_outline
          </span>
          <p className="font-headline text-base font-semibold text-on-surface">
            Viaje no encontrado
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">
            El viaje no existe o no tienes acceso.
          </p>
        </div>
      </main>
    )
  }

  const currencyBase = summary?.currency_base ?? trip.primary_currency

  const visible = expenses
    ? selectedDay
      ? expenses.filter((e) => e.date === selectedDay)
      : expenses
    : []

  // Day totals (only used when selectedDay is set)
  const dayBaseTotal = selectedDay
    ? visible.reduce((sum, e) => sum + Number(e.amount_base), 0)
    : 0

  const dayCurrencyMap = new Map<string, number>()
  if (selectedDay) {
    for (const e of visible) {
      dayCurrencyMap.set(e.currency, (dayCurrencyMap.get(e.currency) ?? 0) + Number(e.amount))
    }
  }
  const dayCurrencyEntries = Array.from(dayCurrencyMap.entries())
  const showOnlyBase =
    dayCurrencyEntries.length === 1 && dayCurrencyEntries[0][0] === trip.budget_currency

  // Top category badge for stats nav card
  const topCat = stats?.by_category?.[0]
  const statsBadge = topCat
    ? `${topCat.category} · ${Math.round(topCat.pct)}%`
    : stats?.expense_count
    ? `${stats.expense_count} gasto${stats.expense_count !== 1 ? "s" : ""}`
    : "Sin datos aún"

  const legsCount = legs?.length ?? 0

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6 min-w-0">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div>
          <Link
            href="/trips"
            className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface transition-colors mb-3"
          >
            <span className="material-symbols-outlined text-base leading-none">arrow_back</span>
            Viajes
          </Link>

          {trip.cover_image_path && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/proxy/trips/${id}/cover`}
              alt={trip.name}
              className="w-full h-44 object-cover rounded-2xl mb-4"
            />
          )}

          <div className="flex items-center gap-2">
            <h1 className="font-headline text-2xl font-bold text-on-surface flex-1">{trip.name}</h1>
            <StatusChip
              current={trip.status}
              onChange={(newStatus) =>
                updateTrip.mutate({ id, data: { status: newStatus } })
              }
              disabled={updateTrip.isPending || isGuest}
            />
            {!isGuest && (
              <button
                type="button"
                onClick={() => router.push(`/trips/${id}/edit`)}
                className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors flex-shrink-0"
                aria-label="Editar viaje"
              >
                <span className="material-symbols-outlined text-[20px] leading-none">edit</span>
              </button>
            )}
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">
            {trip.destination} · {fmtDate(trip.start_date)} – {fmtDate(trip.end_date)}
          </p>
        </div>

        {/* ── Budget card / Day totals ───────────────────────────── */}
        {selectedDay && !expensesLoading && visible.length > 0 ? (
          <div
            className="flex gap-3 overflow-x-auto pb-2"
            style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "thin" }}
          >
            <div
              className="flex-shrink-0 px-5 py-3 rounded-full text-base font-semibold text-white whitespace-nowrap"
              style={{ backgroundColor: "#004d5d" }}
            >
              {fmtAmount(dayBaseTotal, currencyBase)}
            </div>
            {!showOnlyBase && dayCurrencyEntries.map(([currency, total]) => (
              <div
                key={currency}
                className="flex-shrink-0 px-5 py-3 rounded-full text-base font-semibold whitespace-nowrap"
                style={{ backgroundColor: "#e8f0f2", color: "#004d5d" }}
              >
                {fmtAmount(total, currency)}
              </div>
            ))}
          </div>
        ) : (
          <BudgetCard summary={summary} stats={stats} />
        )}

        {/* ── Navigation cards ──────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => router.push(`/trips/${id}/itinerary`)}
            className="flex flex-col items-center gap-2 rounded-xl bg-surface-container-lowest p-3 shadow-editorial text-center hover:bg-surface-container transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-primary-fixed flex items-center justify-center">
              <span className="material-symbols-outlined text-primary-container text-[20px] leading-none">
                route
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-on-surface">Itinerario</p>
              <p className="text-[10px] text-on-surface-variant mt-0.5">
                {legsCount > 0 ? `${legsCount} tramo${legsCount !== 1 ? "s" : ""}` : "Sin tramos"}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => router.push(`/trips/${id}/stats`)}
            className="flex flex-col items-center gap-2 rounded-xl bg-surface-container-lowest p-3 shadow-editorial text-center hover:bg-surface-container transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-secondary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[20px] leading-none">
                bar_chart
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-on-surface">Estadísticas</p>
              <p className="text-[10px] text-on-surface-variant mt-0.5 truncate">{statsBadge}</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => router.push(`/trips/${id}/map`)}
            className="flex flex-col items-center gap-2 rounded-xl bg-surface-container-lowest p-3 shadow-editorial text-center hover:bg-surface-container transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-tertiary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-tertiary text-[20px] leading-none">
                map
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-on-surface">Mapa</p>
              <p className="text-[10px] text-on-surface-variant mt-0.5">Ver ubicaciones</p>
            </div>
          </button>
        </div>

        {/* ── Itinerary preview ─────────────────────────────────── */}
        {legs && legs.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Tramos
              </span>
              <Link
                href={`/trips/${id}/itinerary`}
                className="text-xs text-primary font-medium hover:underline"
              >
                Ver todo
              </Link>
            </div>
            <div className="space-y-2">
              {legs.slice(0, 2).map((leg) => (
                <LegPreviewItem key={leg.id} leg={leg} />
              ))}
            </div>
          </div>
        )}

        {/* ── Day selector ──────────────────────────────────────── */}
        <div
          className="flex gap-2 overflow-x-auto pb-2"
          style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "thin" }}
        >
          <button
            type="button"
            onClick={() => setSelectedDay(null)}
            className={[
              "flex-shrink-0 px-3 py-1 rounded-full text-xs font-label font-semibold transition-colors whitespace-nowrap",
              selectedDay === null
                ? "bg-primary text-white"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high",
            ].join(" ")}
          >
            T
          </button>
          {getTripDays(trip.start_date, trip.end_date).map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day === selectedDay ? null : day)}
              className={[
                "flex-shrink-0 px-3 py-1 rounded-full text-xs font-label font-medium transition-colors whitespace-nowrap",
                selectedDay === day
                  ? "bg-primary text-white"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high",
              ].join(" ")}
            >
              {fmtChipDay(day)}
            </button>
          ))}
        </div>

        {/* ── Expenses section ──────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Gastos
            </span>
            <div className="flex gap-2 flex-wrap justify-end">
              {!isGuest && (
                <button
                  type="button"
                  onClick={() => router.push(`/expenses/scan?tripId=${id}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5
                             bg-surface-container-lowest rounded-full
                             border border-outline-variant/15
                             text-on-surface-variant font-label text-xs
                             hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-sm leading-none">document_scanner</span>
                  Escanear
                </button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setExportOpen(true)}
                disabled={!expenses || expenses.length === 0}
              >
                <span className="material-symbols-outlined text-sm mr-1">download</span>
                Exportar
              </Button>
              {!isGuest && (
                <Button size="sm" onClick={() => setAddExpenseOpen(true)}>
                  <span className="material-symbols-outlined text-sm mr-1">add</span>
                  Añadir
                </Button>
              )}
            </div>
          </div>

          {expensesLoading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-xl bg-surface-container-lowest px-4 py-3 shadow-editorial flex gap-3 items-center"
                >
                  <div className="h-8 w-8 bg-surface-container-high rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-surface-container-high rounded w-3/4" />
                    <div className="h-3 bg-surface-container rounded w-1/3" />
                  </div>
                  <div className="h-4 bg-surface-container-high rounded w-16" />
                </div>
              ))}
            </div>
          ) : !expenses || expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-4">
                receipt_long
              </span>
              <p className="font-headline text-base font-semibold text-on-surface">Sin gastos</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Añade el primer gasto de este viaje.
              </p>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-3">
                event_busy
              </span>
              <p className="text-sm font-medium text-on-surface-variant">
                Sin gastos este día
              </p>
            </div>
          ) : (
            <div
              className="overflow-y-auto space-y-2"
              style={{ maxHeight: "calc(100vh - 380px)" }}
            >
              {visible.map((expense) => (
                <ExpenseCard
                  key={expense.id}
                  expense={expense}
                  currencyBase={currencyBase}
                  onDoubleClick={() => router.push(`/trips/${id}/expenses/${expense.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <AddExpenseModal
        trip={trip}
        open={addExpenseOpen}
        onClose={handleCloseExpenseModal}
      />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        tripId={id}
        tripName={trip.name}
      />
    </main>
  )
}
