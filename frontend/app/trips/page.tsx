"use client"

import { useState } from "react"
import Link from "next/link"
import { useTrips } from "@/hooks/use-trips"
import { TripCard } from "@/components/trip-card"
import { Button } from "@/components/ui/button"
import type { TripStatus } from "@/types/ledger"

type FilterOption = { label: string; value: TripStatus | undefined }

const FILTERS: FilterOption[] = [
  { label: "Todos", value: undefined },
  { label: "Activos", value: "active" },
  { label: "Cerrados", value: "closed" },
  { label: "Borradores", value: "draft" },
]

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
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
