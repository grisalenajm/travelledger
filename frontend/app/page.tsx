"use client"

import { useSession } from "next-auth/react"
import Link from "next/link"
import { useTrips, useTripSummary } from "@/hooks/use-trips"
import { Button } from "@/components/ui/button"
import type { Trip } from "@/types"

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function fmtDateShort(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  })
}

function getTodayString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function getDayNumber(startDate: string, todayStr: string): number {
  const [sy, sm, sd] = startDate.split("-").map(Number)
  const [ty, tm, td] = todayStr.split("-").map(Number)
  const start = new Date(sy, sm - 1, sd)
  const today = new Date(ty, tm - 1, td)
  const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return diff + 1
}

// ─── Subcomponents ─────────────────────────────────────────────────────────

function TripCardSkeleton() {
  return (
    <div className="rounded-xl border-2 border-surface-container-high bg-surface-container-lowest p-5 animate-pulse space-y-2">
      <div className="h-3 w-20 bg-surface-container rounded" />
      <div className="h-5 w-48 bg-surface-container-high rounded" />
      <div className="h-3 w-32 bg-surface-container rounded" />
    </div>
  )
}

/** Desktop trip card — viaje activo o próximo */
function DesktopTripCard({ trip, label, accent }: { trip: Trip; label: string; accent: boolean }) {
  return (
    <Link
      href={`/trips/${trip.id}`}
      className={[
        "block rounded-xl border-2 p-5 shadow-editorial transition-shadow hover:shadow-fab focus:outline-none focus:ring-2 focus:ring-primary/40",
        accent
          ? "border-primary bg-surface-container-lowest"
          : "border-outline-variant bg-surface-container-lowest",
      ].join(" ")}
    >
      <p className={[
        "text-xs font-label font-semibold uppercase tracking-wide mb-1",
        accent ? "text-primary" : "text-on-surface-variant",
      ].join(" ")}>
        {label}
      </p>
      <p className="font-headline text-base font-semibold text-on-surface">
        {trip.name}
      </p>
      <p className="text-sm text-on-surface-variant mt-0.5">{trip.destination}</p>
      <p className="mt-2 text-xs text-on-surface-variant">
        {fmtDate(trip.start_date)} – {fmtDate(trip.end_date)}
      </p>
    </Link>
  )
}

/** Hero card móvil — viaje activo */
function MobileHeroActive({ trip }: { trip: Trip }) {
  const todayStr = getTodayString()
  const dayNumber = getDayNumber(trip.start_date, todayStr)
  const { data: summary } = useTripSummary(trip.id)
  const pct = summary ? Math.min(Number(summary.percentage), 100) : null

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="block mx-4 mt-4 rounded-xl overflow-hidden
                 shadow-fab transition-opacity active:opacity-90 focus:outline-none
                 focus:ring-2 focus:ring-primary/40"
    >
      {/* Franja de portada — igual que TripCard (h-32) */}
      <div className="h-32 w-full relative">
        {trip.cover_image_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/proxy/trips/${trip.id}/cover`}
            alt={trip.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-[#004d64]" />
        )}
      </div>

      {/* Contenido */}
      <div className="bg-primary text-on-primary p-6">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-2 h-2 rounded-full bg-on-primary animate-pulse" />
          <p className="text-xs font-label font-semibold uppercase tracking-widest opacity-80">
            En curso · Día {dayNumber}
          </p>
        </div>
        <p className="font-headline text-xl font-bold truncate">{trip.name}</p>
        <p className="text-sm opacity-75 mt-0.5">{trip.destination}</p>
        <p className="text-xs opacity-60 mt-1">
          {fmtDateShort(trip.start_date)} – {fmtDateShort(trip.end_date)}
        </p>

        {/* Barra de presupuesto */}
        {pct !== null && (
          <div className="mt-4">
            <div className="h-1.5 w-full bg-on-primary/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-on-primary/80 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            {summary && (
              <p className="mt-1 text-xs opacity-60">
                {Number(summary.spent_base).toFixed(0)} / {Number(summary.budget_base).toFixed(0)} {summary.currency_base}
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-1 text-sm font-semibold opacity-90">
          <span>Continuar</span>
          <span className="material-symbols-outlined text-base">arrow_forward</span>
        </div>
      </div>
    </Link>
  )
}

/** Hero card móvil — próximo viaje */
function MobileHeroUpcoming({ trip }: { trip: Trip }) {
  return (
    <Link
      href={`/trips/${trip.id}`}
      className="block mx-4 mt-4 rounded-xl bg-surface-container-low p-6
                 shadow-editorial transition-opacity active:opacity-90 focus:outline-none
                 focus:ring-2 focus:ring-primary/40"
    >
      <p className="text-xs font-label font-semibold uppercase tracking-widest text-on-surface-variant mb-1">
        Próximo viaje
      </p>
      <p className="font-headline text-xl font-bold text-on-surface truncate">{trip.name}</p>
      <p className="text-sm text-on-surface-variant mt-0.5">{trip.destination}</p>
      <p className="mt-2 text-xs text-on-surface-variant">
        Empieza el {fmtDateShort(trip.start_date)}
      </p>
    </Link>
  )
}

/** Acceso rápido — grid 2 botones */
function MobileQuickAccess({ openScan }: { openScan?: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 mx-4 mt-4">
      <Link
        href="/trips"
        className="flex flex-col items-center justify-center gap-2 rounded-xl
                   bg-surface-container-lowest shadow-editorial p-4 min-h-[64px]
                   transition-shadow hover:shadow-fab active:opacity-80"
      >
        <span className="material-symbols-outlined text-xl text-primary">add_circle</span>
        <span className="text-xs font-semibold text-on-surface">+ Gasto</span>
      </Link>

      <Link
        href="/expenses/scan"
        className="flex flex-col items-center justify-center gap-2 rounded-xl
                   bg-surface-container-lowest shadow-editorial p-4 min-h-[64px]
                   transition-shadow hover:shadow-fab active:opacity-80"
      >
        <span className="material-symbols-outlined text-xl text-primary">document_scanner</span>
        <span className="text-xs font-semibold text-on-surface">Escanear</span>
      </Link>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: session } = useSession()
  const { data: allTrips, isLoading: tripsLoading } = useTrips()

  const userName = session?.user?.name

  const todayStr = getTodayString()

  // Viaje activo: por fechas (CLAUDE.md — NO por status)
  const activeTrip = allTrips?.find(
    (t) => t.start_date <= todayStr && todayStr <= t.end_date
  ) ?? null

  // Próximos viajes (futuros, excluir el activo si lo hay)
  const upcomingTrips = (allTrips ?? [])
    .filter((t) => t.start_date > todayStr)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

  // Para desktop — viaje destacado (activo o próximo)
  const nextUpcoming = upcomingTrips[0] ?? null
  const desktopFeatured = activeTrip ?? nextUpcoming

  const hasTrips = (allTrips?.length ?? 0) > 0

  // Estado vacío — sin viajes
  if (!tripsLoading && !hasTrips) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-4">
        <span className="text-6xl mb-4 select-none" aria-hidden="true">✈️</span>
        <h1 className="font-headline text-2xl font-bold text-on-surface">Bienvenido a Ledger</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Empieza creando tu primer viaje para registrar gastos.
        </p>
        <Link href="/trips/new" className="mt-6">
          <Button>Crear viaje</Button>
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">

      {/* ═══════════════════════════════════════════════════
          VISTA MÓVIL — md:hidden
      ═══════════════════════════════════════════════════ */}
      <div className="md:hidden">
        {tripsLoading ? (
          <div className="mx-4 mt-4">
            <TripCardSkeleton />
          </div>
        ) : activeTrip ? (
          <MobileHeroActive trip={activeTrip} />
        ) : nextUpcoming ? (
          <MobileHeroUpcoming trip={nextUpcoming} />
        ) : (
          // Sin viaje activo ni próximo
          <div className="mx-4 mt-4">
            <Link
              href="/trips/new"
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed
                         border-outline-variant bg-surface-container-lowest p-8 text-center
                         transition-colors hover:border-primary focus:outline-none focus:ring-2
                         focus:ring-primary/40"
            >
              <span className="material-symbols-outlined text-3xl text-on-surface-variant/40 mb-2">
                luggage
              </span>
              <p className="text-sm font-medium text-on-surface">Crear tu primer viaje</p>
              <p className="mt-1 text-xs text-on-surface-variant/70">Pulsa para empezar</p>
            </Link>
          </div>
        )}

        {/* B. Acceso rápido */}
        {!tripsLoading && <MobileQuickAccess />}

        {/* C. Próximos viajes (solo si hay viaje activo en hero) */}
        {!tripsLoading && activeTrip && upcomingTrips.length > 0 && (
          <section className="mx-4 mt-6">
            <p className="text-[10px] font-label font-semibold uppercase tracking-widest text-on-surface-variant mb-3">
              Próximos viajes
            </p>
            <div className="space-y-2">
              {upcomingTrips.slice(0, 3).map((trip) => (
                <Link
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className="flex items-center gap-3 rounded-xl bg-surface-container-lowest px-4 py-3
                             shadow-editorial hover:shadow-fab transition-shadow min-h-[56px]"
                >
                  <span className="material-symbols-outlined text-xl text-on-surface-variant flex-shrink-0">
                    flight_takeoff
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{trip.name}</p>
                    <p className="text-xs text-on-surface-variant">{fmtDateShort(trip.start_date)}</p>
                  </div>
                  <span className="material-symbols-outlined text-base text-on-surface-variant/40">
                    chevron_right
                  </span>
                </Link>
              ))}
            </div>
            {upcomingTrips.length > 3 && (
              <Link href="/trips" className="block mt-3 text-sm text-primary text-center hover:underline">
                Ver todos los viajes →
              </Link>
            )}
          </section>
        )}

        {/* Otros viajes (si no hay activo) */}
        {!tripsLoading && !activeTrip && allTrips && allTrips.length > 1 && (
          <section className="mx-4 mt-6 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-label font-semibold uppercase tracking-widest text-on-surface-variant">
                Otros viajes
              </p>
              <Link href="/trips" className="text-xs text-primary hover:underline">
                Ver todos →
              </Link>
            </div>
            <div className="space-y-2">
              {allTrips
                .filter((t) => t.id !== desktopFeatured?.id)
                .slice(0, 3)
                .map((trip) => (
                  <Link
                    key={trip.id}
                    href={`/trips/${trip.id}`}
                    className="flex items-center gap-3 rounded-xl bg-surface-container-lowest px-4 py-3
                               shadow-editorial hover:shadow-fab transition-shadow min-h-[56px]"
                  >
                    <span className="material-symbols-outlined text-xl text-on-surface-variant flex-shrink-0">
                      {trip.start_date > todayStr ? "flight_takeoff" : "check_circle"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-on-surface truncate">{trip.name}</p>
                      <p className="text-xs text-on-surface-variant truncate">{trip.destination}</p>
                    </div>
                    <span className="material-symbols-outlined text-base text-on-surface-variant/40">
                      chevron_right
                    </span>
                  </Link>
                ))}
            </div>
          </section>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════
          VISTA DESKTOP — hidden md:block
      ═══════════════════════════════════════════════════ */}
      <div className="hidden md:block">
        <div className="mx-auto max-w-2xl px-4 py-6 md:py-8 space-y-5 md:space-y-6">
          <h1 className="font-headline text-xl md:text-2xl font-bold text-on-surface">
            Hola{userName ? `, ${userName}` : ""} 👋
          </h1>

          {tripsLoading ? (
            <TripCardSkeleton />
          ) : desktopFeatured ? (
            <DesktopTripCard
              trip={desktopFeatured}
              label={activeTrip ? "Viaje activo" : "Próximo viaje"}
              accent={!!activeTrip}
            />
          ) : (
            <Link
              href="/trips/new"
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-lowest p-8 text-center transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <p className="text-sm font-medium text-on-surface">No hay viaje activo ni próximo</p>
              <p className="mt-1 text-xs text-on-surface-variant/70">Pulsa para crear uno nuevo</p>
            </Link>
          )}

          {/* Lista de otros viajes en desktop */}
          {!tripsLoading && allTrips && allTrips.length > 1 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-headline text-base font-semibold text-on-surface">
                  Otros viajes
                </h2>
                <Link href="/trips" className="text-sm text-primary hover:underline">
                  Ver todos →
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {allTrips
                  .filter((t) => t.id !== desktopFeatured?.id)
                  .slice(0, 3)
                  .map((trip) => (
                    <Link
                      key={trip.id}
                      href={`/trips/${trip.id}`}
                      className="flex items-center gap-4 rounded-xl bg-surface-container-lowest px-4 py-3 shadow-editorial hover:shadow-fab transition-shadow"
                    >
                      <span className="material-symbols-outlined text-xl text-on-surface-variant flex-shrink-0">
                        {trip.status === "closed" ? "check_circle" : "flight_takeoff"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-on-surface truncate">{trip.name}</p>
                        <p className="text-xs text-on-surface-variant truncate">{trip.destination}</p>
                      </div>
                      <span className={[
                        "text-[10px] font-label font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0",
                        trip.status === "active" ? "bg-primary/10 text-primary" :
                        trip.status === "closed" ? "bg-surface-container text-on-surface-variant" :
                        "bg-tertiary/10 text-tertiary",
                      ].join(" ")}>
                        {trip.status === "active" ? "Activo" : trip.status === "closed" ? "Cerrado" : "Borrador"}
                      </span>
                    </Link>
                  ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  )
}
