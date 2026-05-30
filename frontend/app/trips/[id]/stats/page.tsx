"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { useTrip } from "@/hooks/use-trips"
import { useTripStats } from "@/hooks/use-trip-stats"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { Progress } from "@/components/ui/progress"
import { CollapsibleSection } from "@/components/collapsible-section"
import { cn } from "@/lib/utils"

const CATEGORY_COLORS: Record<string, string> = {
  Dining: "#f4845f",
  Transport: "#6ab3e0",
  Lodging: "#70c6a0",
  Culture: "#b39ddb",
  Shopping: "#f7c59f",
  Health: "#ef9a9a",
  Other: "#90a4ae",
}

const PAYMENT_COLORS: Record<string, string> = {
  card: "#004d5d",
  cash: "#70c6a0",
  transfer: "#6ab3e0",
  other: "#90a4ae",
}

const CATEGORY_LABELS: Record<string, string> = {
  Dining: "Restauración",
  Transport: "Transporte",
  Lodging: "Alojamiento",
  Culture: "Cultura",
  Shopping: "Compras",
  Health: "Salud",
  Other: "Otros",
}

const PAYMENT_LABELS: Record<string, string> = {
  card: "Tarjeta",
  cash: "Efectivo",
  transfer: "Transferencia",
  other: "Otro",
}

function fmtAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function fmtDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number)
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
  return `${d} ${months[m - 1]}`
}

function StatCard({ label, value, isMobile }: { label: string; value: string; isMobile: boolean }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={cn(
        "rounded-xl bg-surface-container-lowest px-4 py-3 shadow-editorial transition-all duration-300",
        isMobile && expanded ? "col-span-2" : "col-span-1",
        isMobile && "cursor-pointer select-none"
      )}
      onClick={() => isMobile && setExpanded(e => !e)}
    >
      <p className="text-[10px] font-label font-semibold uppercase tracking-widest text-on-surface-variant mb-1">
        {label}
      </p>
      <p className={cn(
        "font-headline font-bold text-on-surface break-all leading-tight",
        expanded ? "text-2xl" : "text-sm truncate"
      )}>
        {value}
      </p>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6 animate-pulse">
      <div className="h-7 bg-surface-container-high rounded w-48" />
      <div className="flex gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-1 h-16 bg-surface-container-high rounded-xl" />
        ))}
      </div>
      <div className="h-48 bg-surface-container-high rounded-xl" />
      <div className="h-40 bg-surface-container-high rounded-xl" />
    </div>
  )
}

export default function TripStatsPage() {
  const { id } = useParams<{ id: string }>()
  const { data: trip, isLoading: tripLoading } = useTrip(id)
  const { data: stats, isLoading: statsLoading } = useTripStats(id)
  const isMobile = useIsMobile()
  const [expandedBox, setExpandedBox] = useState<string | null>(null)

  function toggleBox(boxId: string) {
    setExpandedBox((prev) => (prev === boxId ? null : boxId))
  }

  if (tripLoading || statsLoading) {
    return (
      <main className="min-h-screen bg-background">
        <PageSkeleton />
      </main>
    )
  }

  if (!trip || !stats) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-4 block">
            error_outline
          </span>
          <p className="font-headline text-base font-semibold text-on-surface">
            Viaje no encontrado
          </p>
        </div>
      </main>
    )
  }

  const isEmpty = stats.expense_count === 0
  const chartHeight = isMobile ? 180 : 240
  const barHeight = isMobile ? 100 : 120
  const topCategory = stats.by_category[0]
  const topPayment = stats.by_payment[0]

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* Header */}
        <div>
          <Link
            href={`/trips/${id}`}
            className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface transition-colors mb-3"
          >
            <span className="material-symbols-outlined text-base leading-none">arrow_back</span>
            {trip.name}
          </Link>
          <h1 className="font-headline text-xl md:text-2xl font-bold text-on-surface">Estadísticas</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {trip.destination} · {stats.expense_count} gasto{stats.expense_count !== 1 ? "s" : ""}
          </p>
        </div>

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-4">
              bar_chart
            </span>
            <p className="font-headline text-base font-semibold text-on-surface">Sin gastos</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Añade gastos al viaje para ver las estadísticas.
            </p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Total"
                value={fmtAmount(stats.total_base, stats.currency_base)}
                isMobile={isMobile}
              />
              <StatCard label="Gastos" value={String(stats.expense_count)} isMobile={isMobile} />
              <StatCard
                label="Media/día"
                value={fmtAmount(stats.avg_per_day, stats.currency_base)}
                isMobile={isMobile}
              />
              <StatCard label="Días" value={String(stats.duration_days)} isMobile={isMobile} />
            </div>

            {/* Budget progress */}
            {stats.budget_base > 0 && (
              <CollapsibleSection
                id="budget"
                label="Presupuesto"
                summary={`${stats.budget_pct.toFixed(0)}%`}
                expandedBox={expandedBox}
                onToggle={toggleBox}
                isMobile={isMobile}
              >
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-label text-on-surface-variant">
                    {fmtAmount(stats.total_base, stats.currency_base)} de{" "}
                    {fmtAmount(stats.budget_base, stats.currency_base)}
                  </span>
                </div>
                <Progress value={stats.budget_pct} className="h-2" />
                <p className="text-xs text-on-surface-variant text-right">
                  {stats.budget_pct.toFixed(1)}% utilizado
                </p>
              </CollapsibleSection>
            )}

            {/* By category — donut */}
            {stats.by_category.length > 0 && (
              <CollapsibleSection
                id="by-category"
                label="Por categoría"
                summary={topCategory ? CATEGORY_LABELS[topCategory.category] ?? topCategory.category : undefined}
                expandedBox={expandedBox}
                onToggle={toggleBox}
                isMobile={isMobile}
              >
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={isMobile ? 120 : 160} height={isMobile ? 120 : 160}>
                    <PieChart>
                      <Pie
                        data={stats.by_category}
                        dataKey="total"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={isMobile ? 34 : 48}
                        outerRadius={isMobile ? 54 : 72}
                        isAnimationActive={false}
                      >
                        {stats.by_category.map((entry) => (
                          <Cell
                            key={entry.category}
                            fill={CATEGORY_COLORS[entry.category] ?? "#90a4ae"}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="flex-1 space-y-1.5 min-w-0">
                    {stats.by_category.map((entry) => (
                      <li key={entry.category} className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: CATEGORY_COLORS[entry.category] ?? "#90a4ae" }}
                        />
                        <span className="text-xs text-on-surface-variant flex-1 truncate">
                          {CATEGORY_LABELS[entry.category] ?? entry.category}
                        </span>
                        <span className="text-xs font-semibold text-on-surface flex-shrink-0">
                          {entry.pct.toFixed(0)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CollapsibleSection>
            )}

            {/* By day — area chart */}
            {stats.by_day.length > 1 && (
              <CollapsibleSection
                id="by-day"
                label="Gasto diario"
                summary={`${stats.by_day.length} días`}
                expandedBox={expandedBox}
                onToggle={toggleBox}
                isMobile={isMobile}
              >
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <AreaChart data={stats.by_day} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#004d5d" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#004d5d" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tickFormatter={fmtDate}
                      tick={{ fontSize: 10, fill: "#78909c" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#78909c" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value: number) =>
                        fmtAmount(value, stats.currency_base)
                      }
                      labelFormatter={fmtDate}
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid #e0e0e0",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#004d5d"
                      strokeWidth={2}
                      fill="url(#areaGrad)"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CollapsibleSection>
            )}

            {/* By payment — bar chart */}
            {stats.by_payment.length > 0 && (
              <CollapsibleSection
                id="by-payment"
                label="Medio de pago"
                summary={topPayment ? PAYMENT_LABELS[topPayment.method] ?? topPayment.method : undefined}
                expandedBox={expandedBox}
                onToggle={toggleBox}
                isMobile={isMobile}
              >
                <ResponsiveContainer width="100%" height={barHeight}>
                  <BarChart
                    data={stats.by_payment}
                    layout="vertical"
                    margin={{ top: 0, right: 8, left: 64, bottom: 0 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: "#78909c" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="method"
                      tickFormatter={(v: string) => PAYMENT_LABELS[v] ?? v}
                      tick={{ fontSize: 11, fill: "#546e7a" }}
                      axisLine={false}
                      tickLine={false}
                      width={60}
                    />
                    <Tooltip
                      formatter={(value: number) =>
                        fmtAmount(value, stats.currency_base)
                      }
                      labelFormatter={(v: string) => PAYMENT_LABELS[v] ?? v}
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid #e0e0e0",
                      }}
                    />
                    <Bar
                      dataKey="total"
                      radius={[0, 4, 4, 0]}
                      isAnimationActive={false}
                    >
                      {stats.by_payment.map((entry) => (
                        <Cell
                          key={entry.method}
                          fill={PAYMENT_COLORS[entry.method] ?? "#90a4ae"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CollapsibleSection>
            )}

            {/* Top merchants */}
            {stats.top_merchants.length > 0 && (
              <CollapsibleSection
                id="top-merchants"
                label="Top establecimientos"
                summary={stats.top_merchants[0]?.name}
                expandedBox={expandedBox}
                onToggle={toggleBox}
                isMobile={isMobile}
              >
                <ul className="space-y-2">
                  {stats.top_merchants.map((m, idx) => (
                    <li
                      key={m.name}
                      className="flex items-center gap-3"
                    >
                      <span className="text-xs font-label font-semibold text-on-surface-variant w-4 text-right flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="flex-1 text-sm text-on-surface truncate">{m.name}</span>
                      <span className="text-sm font-semibold text-on-surface flex-shrink-0">
                        {fmtAmount(m.total, stats.currency_base)}
                      </span>
                      <span className="text-xs text-on-surface-variant flex-shrink-0">
                        ×{m.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}
          </>
        )}
      </div>
    </main>
  )
}
