"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { TripLeg, Trip } from "@/types"
import { Button } from "@/components/ui/button"
import { useMarkAllRead } from "@/hooks/use-notifications"
import { useIsGuest } from "@/hooks/use-is-guest"

function formatDateShort(dt: string | null): string {
  if (!dt) return "—"
  return new Date(dt).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
}

function LegCard({
  leg,
  trips,
  onAssign,
  onDiscard,
}: {
  leg: TripLeg
  trips: Trip[]
  onAssign: (legId: string, tripId: string) => void
  onDiscard: (legId: string) => void
}) {
  const [selectedTrip, setSelectedTrip] = useState("")
  const [assigning, setAssigning] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const isGuest = useIsGuest()

  async function handleAssign() {
    if (!selectedTrip) return
    setAssigning(true)
    try {
      await onAssign(leg.id, selectedTrip)
    } finally {
      setAssigning(false)
    }
  }

  async function handleDiscard() {
    if (!window.confirm("¿Descartar este tramo? No se podrá recuperar.")) return
    setDiscarding(true)
    try {
      await onDiscard(leg.id)
    } finally {
      setDiscarding(false)
    }
  }

  const modeIcon: Record<string, string> = {
    flight: "flight",
    accommodation: "hotel",
    train: "train",
    bus: "directions_bus",
    ferry: "directions_boat",
    car_rental: "car_rental",
    other: "route",
  }

  return (
    <div className="rounded-xl bg-surface-container-lowest p-4 shadow-editorial space-y-3">
      {/* Header del tramo */}
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-primary text-[22px] leading-none mt-0.5">
          {modeIcon[leg.mode] ?? "route"}
        </span>
        <div className="flex-1 min-w-0">
          {leg.mode === "flight" && (
            <>
              <p className="font-medium text-on-surface text-sm">
                {leg.carrier ?? "Aerolínea desconocida"}{leg.flight_number ? ` · ${leg.flight_number}` : ""}
              </p>
              <p className="text-on-surface-variant text-xs mt-0.5">
                {leg.origin ?? "?"} → {leg.destination ?? "?"}
              </p>
              <p className="text-on-surface-variant text-xs">
                {formatDateShort(leg.departure_local)}
                {leg.locator_code ? ` · ${leg.locator_code}` : ""}
              </p>
            </>
          )}
          {leg.mode === "accommodation" && (
            <>
              <p className="font-medium text-on-surface text-sm">
                {leg.accommodation_name ?? "Alojamiento"}
              </p>
              {leg.accommodation_address && (
                <p className="text-on-surface-variant text-xs mt-0.5 truncate">
                  {leg.accommodation_address}
                </p>
              )}
              <p className="text-on-surface-variant text-xs">
                {formatDateShort(leg.check_in)} → {formatDateShort(leg.check_out)}
                {leg.confirmation_number ? ` · ${leg.confirmation_number}` : ""}
              </p>
            </>
          )}
          {leg.mode !== "flight" && leg.mode !== "accommodation" && (
            <>
              <p className="font-medium text-on-surface text-sm capitalize">{leg.mode}</p>
              {(leg.origin || leg.destination) && (
                <p className="text-on-surface-variant text-xs mt-0.5">
                  {leg.origin ?? "?"} → {leg.destination ?? "?"}
                </p>
              )}
              <p className="text-on-surface-variant text-xs">
                {formatDateShort(leg.departure_local ?? leg.check_in ?? leg.pickup_datetime)}
              </p>
            </>
          )}
        </div>
        <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
          {leg.source ?? "manual"}
        </span>
      </div>

      {/* Asignar a viaje — solo visible para usuarios no-guest */}
      {!isGuest && (
        <div className="flex items-center gap-2 pt-1">
          <select
            value={selectedTrip}
            onChange={(e) => setSelectedTrip(e.target.value)}
            className="flex-1 bg-transparent border border-outline rounded-lg px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none appearance-none"
          >
            <option value="">— Selecciona un viaje —</option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.destination}
              </option>
            ))}
          </select>
          <Button
            onClick={handleAssign}
            disabled={!selectedTrip || assigning || discarding}
            className="shrink-0"
          >
            {assigning ? "…" : "Asignar"}
          </Button>
          <Button
            onClick={handleDiscard}
            disabled={assigning || discarding}
            variant="ghost"
            className="shrink-0 text-error hover:bg-error/10"
          >
            {discarding ? "…" : "Descartar"}
          </Button>
        </div>
      )}
    </div>
  )
}

export default function PendingLegsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const markAllRead = useMarkAllRead()

  useEffect(() => {
    markAllRead.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: legs = [], isLoading: legsLoading } = useQuery<TripLeg[]>({
    queryKey: ["legs", "pending"],
    queryFn: () => api.get<TripLeg[]>("/api/proxy/legs/pending"),
  })

  const { data: trips = [], isLoading: tripsLoading } = useQuery<Trip[]>({
    queryKey: ["trips"],
    queryFn: () => api.get<Trip[]>("/api/proxy/trips"),
  })

  const assignMutation = useMutation({
    mutationFn: ({ legId, tripId }: { legId: string; tripId: string }) =>
      api.put<TripLeg>(`/api/proxy/legs/${legId}/assign`, { trip_id: tripId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legs", "pending"] })
    },
  })

  const discardMutation = useMutation({
    mutationFn: (legId: string) =>
      api.delete<void>(`/api/proxy/legs/${legId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legs", "pending"] })
    },
  })

  async function handleAssign(legId: string, tripId: string) {
    await assignMutation.mutateAsync({ legId, tripId })
  }

  async function handleDiscard(legId: string) {
    await discardMutation.mutateAsync(legId)
  }

  const isLoading = legsLoading || tripsLoading

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-on-surface-variant hover:text-on-surface transition-colors"
            aria-label="Volver"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="font-headline text-2xl font-bold text-on-surface">
              Tramos pendientes
            </h1>
            {!isLoading && (
              <p className="mt-0.5 text-sm text-on-surface-variant">
                {legs.length === 0
                  ? "No hay tramos pendientes de asignación"
                  : `${legs.length} tramo${legs.length !== 1 ? "s" : ""} sin asignar a un viaje`}
              </p>
            )}
          </div>
        </div>

        {isLoading && (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-surface-container-high rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && legs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">
              check_circle
            </span>
            <p className="mt-4 text-on-surface-variant text-sm">
              Todos los tramos están asignados.
            </p>
          </div>
        )}

        {!isLoading && legs.length > 0 && (
          <div className="space-y-4">
            {legs.map((leg) => (
              <LegCard
                key={leg.id}
                leg={leg}
                trips={trips}
                onAssign={handleAssign}
                onDiscard={handleDiscard}
              />
            ))}
          </div>
        )}

        {!isLoading && trips.length === 0 && legs.length > 0 && (
          <div className="rounded-xl bg-secondary-container px-4 py-3">
            <p className="text-on-secondary-container text-sm">
              No tienes viajes creados todavía.{" "}
              <button
                onClick={() => router.push("/trips/new")}
                className="underline font-medium"
              >
                Crea un viaje
              </button>{" "}
              para poder asignar estos tramos.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
