"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useTrip, useTripSummary } from "@/hooks/use-trips"
import { useExpenses } from "@/hooks/use-expenses"
import { ExpenseCard } from "@/components/expense-card"
import { AddExpenseModal } from "@/components/add-expense-modal"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"

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

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 bg-surface-container-high rounded w-56" />
        <div className="h-4 bg-surface-container rounded w-40" />
      </div>
      <div className="rounded-xl bg-surface-container-lowest p-5 shadow-editorial space-y-4">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <div className="h-3 bg-surface-container rounded w-16" />
            <div className="h-8 bg-surface-container-high rounded w-28" />
          </div>
          <div className="space-y-1 text-right">
            <div className="h-3 bg-surface-container rounded w-20" />
            <div className="h-5 bg-surface-container rounded w-24" />
          </div>
        </div>
        <div className="h-2 bg-surface-container-high rounded-full" />
        <div className="h-4 bg-surface-container rounded w-48" />
      </div>
      <div className="flex gap-4 border-b border-outline-variant pb-0">
        <div className="h-8 bg-surface-container-high rounded w-16" />
        <div className="h-8 bg-surface-container rounded w-16" />
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

type Tab = "expenses" | "legs"

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("expenses")
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const handleCloseExpenseModal = useCallback(() => setAddExpenseOpen(false), [])

  async function handleExportCsv() {
    if (!trip) return
    setExporting(true)
    try {
      const res = await fetch(`/api/proxy/reports/export/${id}?format=csv`)
      if (!res.ok) throw new Error("Export failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `gastos_${trip.name}_${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error("CSV export failed", e)
    } finally {
      setExporting(false)
    }
  }

  const { data: trip, isLoading: tripLoading, isError } = useTrip(id)
  const { data: summary } = useTripSummary(id)
  const { data: expenses, isLoading: expensesLoading } = useExpenses(id)

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

  const overBudget = summary !== undefined && Number(summary.percentage) > 100
  const hasBudget = summary !== undefined && Number(summary.budget_base) > 0
  const currencyBase = summary?.currency_base ?? trip.primary_currency

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        {/* Back link */}
        <Link
          href="/trips"
          className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-base leading-none">arrow_back</span>
          Viajes
        </Link>

        {/* Header */}
        <div>
          <Link
            href="/trips"
            className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface transition-colors mb-3"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Viajes
          </Link>
          <h1 className="font-headline text-2xl font-bold text-on-surface">{trip.name}</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {trip.destination} · {fmtDate(trip.start_date)} – {fmtDate(trip.end_date)}
          </p>
        </div>

        {/* Summary card */}
        {summary && (
          <div className="rounded-xl bg-surface-container-lowest p-5 shadow-editorial">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-label font-bold tracking-widest uppercase text-on-surface-variant">
                  Gastado
                </p>
                <p className="font-headline text-3xl font-extrabold text-on-surface leading-none mt-1">
                  {Number(summary.spent_base).toFixed(2)}{" "}
                  <span className="text-lg font-semibold text-on-surface-variant">
                    {summary.currency_base}
                  </span>
                </p>
              </div>
              {hasBudget && (
                <div className="text-right">
                  <p className="text-[10px] font-label font-bold tracking-widest uppercase text-on-surface-variant">
                    Presupuesto
                  </p>
                  <p className="mt-1 text-base font-semibold text-on-surface">
                    {Number(summary.budget_base).toFixed(2)} {summary.currency_base}
                  </p>
                </div>
              )}
            </div>

            {hasBudget && (
              <>
                <div className="mt-4">
                  <Progress
                    value={Number(summary.percentage)}
                    indicatorClassName={overBudget ? "bg-error" : undefined}
                  />
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-on-surface-variant">
                  <span>{summary.expense_count} gastos</span>
                  <span>·</span>
                  <span>{summary.legs_count} tramos</span>
                  <span>·</span>
                  <span className={overBudget ? "text-error font-semibold" : ""}>
                    {Number(summary.percentage).toFixed(0)}% del presupuesto
                  </span>
                </div>
              </>
            )}

            {!hasBudget && summary && (
              <div className="mt-2 flex items-center gap-2 text-xs text-on-surface-variant">
                <span>{summary.expense_count} gastos</span>
                <span>·</span>
                <span>{summary.legs_count} tramos</span>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-outline-variant">
          {(["expenses", "legs"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "px-4 py-2.5 text-sm font-label font-medium transition-colors border-b-2 -mb-px",
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-on-surface-variant hover:text-on-surface",
              ].join(" ")}
            >
              {t === "expenses" ? "Gastos" : "Tramos"}
            </button>
          ))}
        </div>

        {/* Tab: Gastos */}
        {tab === "expenses" && (
          <div className="space-y-4">
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportCsv}
                disabled={exporting || !expenses || expenses.length === 0}
              >
                <span className="material-symbols-outlined text-sm mr-1">download</span>
                {exporting ? "Exportando…" : "Exportar CSV"}
              </Button>
              <Button size="sm" onClick={() => setAddExpenseOpen(true)}>
                <span className="material-symbols-outlined text-sm mr-1">add</span>
                Añadir gasto
              </Button>
            </div>

            {/* Day selector */}
            <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {/* "T" = todo */}
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className={[
                  "shrink-0 px-3 py-1 rounded-full text-xs font-label font-semibold transition-colors",
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
                    "shrink-0 px-3 py-1 rounded-full text-xs font-label font-medium transition-colors whitespace-nowrap",
                    selectedDay === day
                      ? "bg-primary text-white"
                      : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high",
                  ].join(" ")}
                >
                  {fmtChipDay(day)}
                </button>
              ))}
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
            ) : (() => {
              const visible = selectedDay
                ? expenses.filter((e) => e.date === selectedDay)
                : expenses
              return visible.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-3">
                    event_busy
                  </span>
                  <p className="text-sm font-medium text-on-surface-variant">
                    Sin gastos este día
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {visible.map((expense) => (
                    <ExpenseCard
                      key={expense.id}
                      expense={expense}
                      currencyBase={currencyBase}
                      onDoubleClick={() => router.push(`/trips/${id}/expenses/${expense.id}`)}
                    />
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {/* Tab: Tramos */}
        {tab === "legs" && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-4">
              route
            </span>
            <p className="font-headline text-base font-semibold text-on-surface">Próximamente</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              La gestión de tramos estará disponible pronto.
            </p>
          </div>
        )}
      </div>

      <AddExpenseModal
        trip={trip}
        open={addExpenseOpen}
        onClose={handleCloseExpenseModal}
      />
    </main>
  )
}
