"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useTrip, useTripSummary } from "@/hooks/use-trips"
import { useExpenses } from "@/hooks/use-expenses"
import { ExpenseCard } from "@/components/expense-card"
import { AddExpenseModal } from "@/components/add-expense-modal"
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

function fmtAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 bg-surface-container-high rounded w-56" />
        <div className="h-4 bg-surface-container rounded w-40" />
      </div>
      <div className="flex gap-3">
        <div className="h-12 bg-surface-container-high rounded-full w-36" />
        <div className="h-12 bg-surface-container rounded-full w-28" />
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

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
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

  const currencyBase = summary?.currency_base ?? trip.primary_currency

  const visible = expenses
    ? selectedDay
      ? expenses.filter((e) => e.date === selectedDay)
      : expenses
    : []

  const baseTotal = visible.reduce((sum, e) => sum + Number(e.amount_base), 0)

  const currencyTotalsMap = new Map<string, number>()
  for (const e of visible) {
    currencyTotalsMap.set(e.currency, (currencyTotalsMap.get(e.currency) ?? 0) + Number(e.amount))
  }
  const currencyEntries = Array.from(currencyTotalsMap.entries())
  const showOnlyBase =
    currencyEntries.length === 1 && currencyEntries[0][0] === trip.budget_currency

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6 min-w-0">

        {/* Header */}
        <div>
          <Link
            href="/trips"
            className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface transition-colors mb-3"
          >
            <span className="material-symbols-outlined text-base leading-none">arrow_back</span>
            Viajes
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="font-headline text-2xl font-bold text-on-surface flex-1">{trip.name}</h1>
            <button
              type="button"
              onClick={() => router.push(`/trips/${id}/edit`)}
              className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors flex-shrink-0"
              aria-label="Editar viaje"
            >
              <span className="material-symbols-outlined text-[20px] leading-none">edit</span>
            </button>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">
            {trip.destination} · {fmtDate(trip.start_date)} – {fmtDate(trip.end_date)}
          </p>
        </div>

        {/* Totals bar */}
        {!expensesLoading && visible.length > 0 && (
          <div
            className="flex gap-3 overflow-x-scroll pb-2"
            style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "thin" }}
          >
            <div
              className="flex-shrink-0 px-5 py-3 rounded-full text-base font-semibold text-white whitespace-nowrap"
              style={{ backgroundColor: "#004d5d" }}
            >
              {fmtAmount(baseTotal, currencyBase)}
            </div>
            {!showOnlyBase && currencyEntries.map(([currency, total]) => (
              <div
                key={currency}
                className="flex-shrink-0 px-5 py-3 rounded-full text-base font-semibold whitespace-nowrap"
                style={{ backgroundColor: "#e8f0f2", color: "#004d5d" }}
              >
                {fmtAmount(total, currency)}
              </div>
            ))}
          </div>
        )}

        {/* Day selector */}
        <div
          className="flex gap-2 overflow-x-scroll pb-2"
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

        {/* Expense list */}
        <div className="space-y-4">
          <div className="flex justify-end gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCsv}
              disabled={exporting || !expenses || expenses.length === 0}
            >
              <span className="material-symbols-outlined text-sm mr-1">download</span>
              {exporting ? "Exportando…" : "Exportar CSV"}
            </Button>
            <button
              type="button"
              onClick={() => router.push(`/expenses/scan?tripId=${id}`)}
              className="flex items-center gap-2 px-5 py-2.5
                         bg-surface-container-lowest rounded-full
                         border border-outline-variant/15
                         text-on-surface-variant font-label text-sm
                         hover:bg-surface-container-low transition-colors"
            >
              <span className="material-symbols-outlined text-sm">document_scanner</span>
              Escanear ticket
            </button>
            <Button size="sm" onClick={() => setAddExpenseOpen(true)}>
              <span className="material-symbols-outlined text-sm mr-1">add</span>
              Añadir gasto
            </Button>
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
    </main>
  )
}
