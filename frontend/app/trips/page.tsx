"use client"

import { useState } from "react"
import Link from "next/link"
import { useTrips, useUpdateTrip } from "@/hooks/use-trips"
import { TripCard } from "@/components/trip-card"
import { Button } from "@/components/ui/button"
import type { Trip, TripStatus } from "@/types/ledger"

type FilterOption = { label: string; value: TripStatus | undefined }

const FILTERS: FilterOption[] = [
  { label: "Todos", value: undefined },
  { label: "Activos", value: "active" },
  { label: "Cerrados", value: "closed" },
  { label: "Borradores", value: "draft" },
]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function getTodayString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function findHeroTrip(trips: Trip[]): Trip | null {
  const today = getTodayString()
  const candidates = trips.filter(t => t.start_date <= today && today <= t.end_date)
  if (!candidates.length) return null
  return candidates.sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
}

function TripCardSkeleton() {
  return (
    <div className="rounded-xl bg-surface-container-lowest p-5 shadow-editorial animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-surface-container-high rounded w-3/4" />
          <div className="h-3 bg-surface-container rounded w-1/2" />
        </div>
        <div className="h-5 w-16 bg-surface-container-high rounded-full" />
      </div>
      <div className="mt-2 h-3 bg-surface-container rounded w-40" />
    </div>
  )
}

export default function TripsPage() {
  const [status, setStatus] = useState<TripStatus | undefined>(undefined)
  const { data: trips, isLoading } = useTrips(status)
  const { data: allTrips } = useTrips(undefined)
  const heroTrip = allTrips ? findHeroTrip(allTrips) : null
  const updateTrip = useUpdateTrip()

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-headline text-2xl font-bold text-on-surface">Viajes</h1>
          <Link href="/trips/new">
            <Button size="md">
              <span className="material-symbols-outlined text-sm mr-1.5">add</span>
              Nuevo viaje
            </Button>
          </Link>
        </div>

        {heroTrip && (
          <div className="mb-8">
            <p className="text-xs font-label uppercase tracking-widest text-on-surface-variant mb-3">
              Viaje en curso
            </p>
            <Link
              href={`/trips/${heroTrip.id}`}
              className="block rounded-2xl overflow-hidden bg-surface-container-lowest shadow-fab active:scale-[0.98] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/40 select-none"
            >
              {heroTrip.cover_image_path && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/proxy/trips/${heroTrip.id}/cover`}
                  alt={heroTrip.name}
                  className="w-full h-44 object-cover"
                />
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-headline text-xl font-bold text-on-surface truncate">
                      {heroTrip.name}
                    </p>
                    <p className="mt-0.5 text-sm text-on-surface-variant">{heroTrip.destination}</p>
                  </div>
                  <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary text-on-primary text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-on-primary animate-pulse" />
                    En curso
                  </span>
                </div>
                <p className="mt-2 text-xs text-on-surface-variant">
                  {fmtDate(heroTrip.start_date)} – {fmtDate(heroTrip.end_date)}
                </p>
              </div>
            </Link>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setStatus(f.value)}
              className={[
                "shrink-0 rounded-full px-4 py-1.5 text-sm font-label font-medium transition-colors",
                status === f.value
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high",
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <TripCardSkeleton />
            <TripCardSkeleton />
            <TripCardSkeleton />
          </div>
        ) : !trips || trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-4">
              luggage
            </span>
            <p className="font-headline text-base font-semibold text-on-surface">
              Sin viajes
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              {status
                ? "No hay viajes con ese estado."
                : "Crea tu primer viaje para empezar."}
            </p>
            {!status && (
              <Link href="/trips/new" className="mt-6">
                <Button>Crear viaje</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {trips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onStatusChange={(newStatus) =>
                  updateTrip.mutate({ id: trip.id, data: { status: newStatus } })
                }
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
