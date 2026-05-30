"use client"

import { useState } from "react"
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts"
import { useGlobalStats } from "@/hooks/use-global-stats"
import { useFlightStats } from "@/hooks/use-flight-stats"
import { useIsMobile } from "@/hooks/use-is-mobile"
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

const TRIP_COLORS = [
  "#004d5d", "#6ab3e0", "#70c6a0", "#b39ddb", "#f4845f", "#f7c59f", "#90a4ae",
]

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR]

function fmtAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function fmtKm(km: number): string {
  return `${km.toLocaleString("es-ES", { maximumFractionDigits: 0 })} km`
}

function fmtMonth(yyyyMm: string): string {
  const [, m] = yyyyMm.split("-").map(Number)
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
  return months[m - 1] ?? yyyyMm
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
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-16 bg-surface-container-high rounded-full" />
        ))}
      </div>
      <div className="flex gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 h-16 bg-surface-container-high rounded-xl" />
        ))}
      </div>
      <div className="h-48 bg-surface-container-high rounded-xl" />
      <div className="h-40 bg-surface-container-high rounded-xl" />
    </div>
  )
}

export default function GlobalStatsPage() {
  const [year, setYear] = useState(CURRENT_YEAR)
  const period = "year"

  const { data: stats, isLoading: statsLoading } = useGlobalStats(period, year)
  const { data: flights, isLoading: flightsLoading } = useFlightStats(period, year)
  const isMobile = useIsMobile()
  const [expandedBox, setExpandedBox] = useState<string | null>(null)

  function toggleBox(boxId: string) {
    setExpandedBox((prev) => (prev === boxId ? null : boxId))
  }

  if (statsLoading || flightsLoading) {
    return (
      <main className="min-h-screen bg-background">
        <PageSkeleton />
      </main>
    )
  }

  const isEmpty = !stats || stats.expense_count === 0
  const chartHeight = isMobile ? 180 : 240
  const donutSize = isMobile ? 110 : 140
  const donutInner = isMobile ? 30 : 40
  const donutOuter = isMobile ? 50 : 64
  const topCategory = stats?.by_category[0]
  const topPayment = stats?.by_payment[0]

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* Header */}
        <div>
          <h1 className="font-headline text-xl md:text-2xl font-bold text-on-surface">Estadísticas globales</h1>
          {stats && (
            <p className="mt-1 text-sm text-on-surface-variant">
              {stats.expense_count} gasto{stats.expense_count !== 1 ? "s" : ""} en {stats.trip_count} viaje{stats.trip_count !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Year selector */}
        <div className="flex gap-2">
          {YEAR_OPTIONS.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              className={[
                "px-4 py-1.5 rounded-full text-sm font-label font-medium transition-colors min-h-[44px]",
                year === y
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high",
              ].join(" ")}
            >
              {y}
            </button>
          ))}
        </div>

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-4">
              bar_chart
            </span>
            <p className="font-headline text-base font-semibold text-on-surface">Sin gastos en {year}</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Añade gastos a tus viajes para ver las estadísticas anuales.
            </p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard
                label="Total"
                value={fmtAmount(stats.total_base, stats.currency_base)}
                isMobile={isMobile}
              />
              <StatCard label="Gastos" value={String(stats.expense_count)} isMobile={isMobile} />
              <StatCard label="Viajes" value={String(stats.trip_count)} isMobile={isMobile} />
            </div>

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
                  <ResponsiveContainer width={donutSize} height={donutSize}>
                    <PieChart>
                      <Pie
                        data={stats.by_category}
                        dataKey="total"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={donutInner}
                        outerRadius={donutOuter}
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

            {/* By month — area chart */}
            {stats.by_month.length > 0 && (
              <CollapsibleSection
                id="by-month"
                label="Gasto mensual"
                summary={`${stats.by_month.length} mes${stats.by_month.length !== 1 ? "es" : ""}`}
                expandedBox={expandedBox}
                onToggle={toggleBox}
                isMobile={isMobile}
              >
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <AreaChart data={stats.by_month} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGradGlobal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#004d5d" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#004d5d" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="month"
                      tickFormatter={fmtMonth}
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
                      formatter={(value: number) => fmtAmount(value, stats.currency_base)}
                      labelFormatter={fmtMonth}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e0e0e0" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#004d5d"
                      strokeWidth={2}
                      fill="url(#areaGradGlobal)"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CollapsibleSection>
            )}

            {/* By payment — donut */}
            {stats.by_payment.length > 0 && (
              <CollapsibleSection
                id="by-payment"
                label="Medio de pago"
                summary={topPayment ? PAYMENT_LABELS[topPayment.method] ?? topPayment.method : undefined}
                expandedBox={expandedBox}
                onToggle={toggleBox}
                isMobile={isMobile}
              >
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={donutSize} height={donutSize}>
                    <PieChart>
                      <Pie
                        data={stats.by_payment}
                        dataKey="total"
                        nameKey="method"
                        cx="50%"
                        cy="50%"
                        innerRadius={donutInner}
                        outerRadius={donutOuter}
                        isAnimationActive={false}
                      >
                        {stats.by_payment.map((entry) => (
                          <Cell
                            key={entry.method}
                            fill={PAYMENT_COLORS[entry.method] ?? "#90a4ae"}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="flex-1 space-y-1.5 min-w-0">
                    {stats.by_payment.map((entry) => (
                      <li key={entry.method} className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: PAYMENT_COLORS[entry.method] ?? "#90a4ae" }}
                        />
                        <span className="text-xs text-on-surface-variant flex-1 truncate">
                          {PAYMENT_LABELS[entry.method] ?? entry.method}
                        </span>
                        <span className="text-xs font-semibold text-on-surface flex-shrink-0">
                          {fmtAmount(entry.total, stats.currency_base)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CollapsibleSection>
            )}

            {/* By trip — horizontal bar chart */}
            {stats.by_trip.length > 0 && (
              <CollapsibleSection
                id="by-trip"
                label="Comparativa por viaje"
                summary={`${stats.by_trip.length} viaje${stats.by_trip.length !== 1 ? "s" : ""}`}
                expandedBox={expandedBox}
                onToggle={toggleBox}
                isMobile={isMobile}
              >
                <ResponsiveContainer width="100%" height={Math.max(80, stats.by_trip.length * (isMobile ? 32 : 40))}>
                  <BarChart
                    data={stats.by_trip}
                    layout="vertical"
                    margin={{ top: 0, right: 8, left: 8, bottom: 0 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: "#78909c" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="trip_name"
                      tick={{ fontSize: 11, fill: "#546e7a" }}
                      axisLine={false}
                      tickLine={false}
                      width={isMobile ? 80 : 100}
                      tickFormatter={(v: string) => {
                        const max = isMobile ? 11 : 14
                        return v.length > max ? v.slice(0, max - 1) + "…" : v
                      }}
                    />
                    <Tooltip
                      formatter={(value: number) => fmtAmount(value, stats.currency_base)}
                      labelFormatter={(v: string) => v}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e0e0e0" }}
                    />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                      {stats.by_trip.map((_, idx) => (
                        <Cell key={idx} fill={TRIP_COLORS[idx % TRIP_COLORS.length]} />
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
                    <li key={m.name} className="flex items-center gap-3">
                      <span className="text-xs font-label font-semibold text-on-surface-variant w-4 text-right flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="flex-1 text-sm text-on-surface truncate">{m.name}</span>
                      <span className="text-sm font-semibold text-on-surface flex-shrink-0">
                        {fmtAmount(m.total, stats.currency_base)}
                      </span>
                      <span className="text-xs text-on-surface-variant flex-shrink-0">×{m.count}</span>
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}
          </>
        )}

        {/* Flights section */}
        {flights && flights.total_flights > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 pt-2">
              <span className="material-symbols-outlined text-base text-on-surface-variant">flight</span>
              <h2 className="font-headline text-base font-bold text-on-surface">Vuelos {year}</h2>
            </div>

            {/* Flight summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard label="Vuelos" value={String(flights.total_flights)} isMobile={isMobile} />
              <StatCard label="Total km" value={fmtKm(flights.total_km)} isMobile={isMobile} />
              <StatCard label="Media km" value={fmtKm(flights.avg_km_per_flight)} isMobile={isMobile} />
            </div>

            {/* By carrier */}
            {flights.by_carrier.length > 0 && (
              <CollapsibleSection
                id="by-carrier"
                label="Por aerolínea"
                summary={flights.by_carrier[0]?.carrier}
                expandedBox={expandedBox}
                onToggle={toggleBox}
                isMobile={isMobile}
              >
                <ul className="space-y-2">
                  {flights.by_carrier.map((c) => (
                    <li key={c.carrier} className="flex items-center gap-3">
                      <span className="flex-1 text-sm text-on-surface truncate">{c.carrier}</span>
                      <span className="text-xs text-on-surface-variant flex-shrink-0">
                        {c.flights} vuelo{c.flights !== 1 ? "s" : ""}
                      </span>
                      {c.km > 0 && (
                        <span className="text-sm font-semibold text-on-surface flex-shrink-0">
                          {fmtKm(c.km)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {/* Top routes */}
            {flights.top_routes.length > 0 && (
              <CollapsibleSection
                id="top-routes"
                label="Rutas frecuentes"
                summary={flights.top_routes[0]?.route}
                expandedBox={expandedBox}
                onToggle={toggleBox}
                isMobile={isMobile}
              >
                <ul className="space-y-2">
                  {flights.top_routes.map((r, idx) => (
                    <li key={r.route} className="flex items-center gap-3">
                      <span className="text-xs font-label font-semibold text-on-surface-variant w-4 text-right flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="flex-1 text-sm text-on-surface font-medium truncate">{r.route}</span>
                      <span className="text-xs text-on-surface-variant flex-shrink-0">
                        ×{r.flights}
                      </span>
                      {r.km > 0 && (
                        <span className="text-sm font-semibold text-on-surface flex-shrink-0">
                          {fmtKm(r.km)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}
          </div>
        )}

        {/* Empty flights hint when no expenses but page is loaded */}
        {flights && flights.total_flights === 0 && !isEmpty && (
          <div className="rounded-xl bg-surface-container-lowest px-4 py-4 shadow-editorial flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-on-surface-variant/40">flight</span>
            <p className="text-sm text-on-surface-variant">Sin vuelos registrados en {year}.</p>
          </div>
        )}

      </div>
    </main>
  )
}
