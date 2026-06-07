"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useTrip, useTrips } from "@/hooks/use-trips"
import { useExpenses } from "@/hooks/use-expenses"
import { useTripLegs, useDeleteLeg, useCreateLeg } from "@/hooks/use-trip-legs"
import { LegCard } from "@/components/leg-card"
import { AddLegModal } from "@/components/add-leg-modal"
import { BoardingPassScanner } from "@/components/boarding-pass-scanner"
import { Button } from "@/components/ui/button"
import { useIsGuest } from "@/hooks/use-is-guest"
import type { TripLeg, LegMode, Trip } from "@/types/index"

type FilterMode = "all" | "flight" | "accommodation" | "car_rental" | "ground"

const FILTERS: { value: FilterMode; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "flight", label: "Vuelos" },
  { value: "accommodation", label: "Alojamiento" },
  { value: "car_rental", label: "Coche" },
  { value: "ground", label: "Otros" },
]

function matchesFilter(leg: TripLeg, filter: FilterMode): boolean {
  if (filter === "all") return true
  if (filter === "ground") return leg.mode === "train" || leg.mode === "bus" || leg.mode === "ferry" || leg.mode === "other"
  return leg.mode === (filter as LegMode)
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-4 animate-pulse">
      <div className="h-7 bg-surface-container-high rounded w-48" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-7 bg-surface-container-high rounded-full w-20" />
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl bg-surface-container-lowest px-4 py-3 shadow-editorial flex gap-3 items-center">
          <div className="w-9 h-9 rounded-full bg-surface-container-high" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-surface-container-high rounded w-3/4" />
            <div className="h-3 bg-surface-container rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ItineraryPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<FilterMode>("all")
  const [modalOpen, setModalOpen] = useState(false)
  const [editLeg, setEditLeg] = useState<TripLeg | undefined>()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bpScannerLeg, setBpScannerLeg] = useState<TripLeg | null>(null)
  const [bpCreating, setBpCreating] = useState(false)
  const [reassignLeg, setReassignLeg] = useState<TripLeg | null>(null)
  const [targetTripId, setTargetTripId] = useState("")
  const [isReassigning, setIsReassigning] = useState(false)

  const { data: trip, isLoading: tripLoading } = useTrip(id)
  const { data: legs, isLoading: legsLoading, refetch: refetchLegs } = useTripLegs(id)
  const { data: expenses } = useExpenses(id)
  const { data: allTrips } = useTrips()
  const deleteLeg = useDeleteLeg(id)
  const createLeg = useCreateLeg(id)
  const isGuest = useIsGuest()

  const otherTrips = (allTrips ?? []).filter((t: Trip) => t.id !== id)

  const handleReassignLeg = async () => {
    if (!reassignLeg || !targetTripId) return
    setIsReassigning(true)
    try {
      const res = await fetch(
        `/api/proxy/trips/${reassignLeg.trip_id}/legs/${reassignLeg.id}/reassign`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trip_id: targetTripId }),
        }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { detail?: string }).detail ?? "Error al reasignar")
      }
      queryClient.invalidateQueries({ queryKey: ["legs", id] })
      queryClient.invalidateQueries({ queryKey: ["trips"] })
      refetchLegs()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al reasignar")
    } finally {
      setIsReassigning(false)
      setReassignLeg(null)
      setTargetTripId("")
    }
  }

  const handleEdit = (leg: TripLeg) => {
    setEditLeg(leg)
    setModalOpen(true)
  }

  /** Create a blank flight leg then open the boarding pass scanner on it */
  const handleScanNewBoardingPass = async () => {
    if (!trip) return
    setBpCreating(true)
    try {
      const newLeg = await createLeg.mutateAsync({ mode: "flight" })
      setBpScannerLeg(newLeg)
    } catch {
      // silently ignore — user can add leg manually
    } finally {
      setBpCreating(false)
    }
  }

  const handleDelete = async (leg: TripLeg) => {
    if (deletingId === leg.id) {
      await deleteLeg.mutateAsync(leg.id)
      setDeletingId(null)
    } else {
      setDeletingId(leg.id)
    }
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditLeg(undefined)
  }

  if (tripLoading || legsLoading) {
    return (
      <main className="min-h-screen bg-background">
        <PageSkeleton />
      </main>
    )
  }

  if (!trip) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-4 block">error_outline</span>
          <p className="font-headline text-base font-semibold text-on-surface">Viaje no encontrado</p>
        </div>
      </main>
    )
  }

  const visible = (legs ?? []).filter((l) => matchesFilter(l, filter))

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">

        {/* Header */}
        <div>
          <Link
            href={`/trips/${id}`}
            className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface transition-colors mb-3"
          >
            <span className="material-symbols-outlined text-base leading-none">arrow_back</span>
            {trip.name}
          </Link>
          <h1 className="font-headline text-2xl font-bold text-on-surface">Itinerario</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {trip.destination} · {legs?.length ?? 0} tramo{legs?.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={[
                "flex-shrink-0 px-3 py-1 rounded-full text-xs font-label font-semibold transition-colors whitespace-nowrap",
                filter === f.value
                  ? "bg-primary text-white"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high",
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Leg list */}
        <div className="space-y-2">
          {!isGuest && (
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleScanNewBoardingPass}
                disabled={bpCreating}
                title="Crear tramo de vuelo desde boarding pass"
              >
                <span className="material-symbols-outlined text-sm mr-1">airplane_ticket</span>
                {bpCreating ? "Creando…" : "Boarding pass"}
              </Button>
              <Button
                size="sm"
                onClick={() => { setEditLeg(undefined); setModalOpen(true) }}
              >
                <span className="material-symbols-outlined text-sm mr-1">add</span>
                Añadir tramo
              </Button>
            </div>
          )}

          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-4">
                route
              </span>
              <p className="font-headline text-base font-semibold text-on-surface">Sin tramos</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                {filter === "all"
                  ? "Añade el primer tramo de este viaje."
                  : "No hay tramos con este filtro."}
              </p>
            </div>
          ) : (
            visible.map((leg) => (
              <div key={leg.id} className="relative">
                <LegCard
                  leg={leg}
                  onEdit={isGuest ? undefined : handleEdit}
                  onDelete={isGuest ? undefined : handleDelete}
                />
                {deletingId === leg.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-surface-container-lowest/80 rounded-xl gap-2">
                    <button
                      type="button"
                      onClick={() => setDeletingId(null)}
                      className="px-3 py-1.5 rounded-full text-xs font-label font-semibold bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(leg)}
                      disabled={deleteLeg.isPending}
                      className="px-3 py-1.5 rounded-full text-xs font-label font-semibold bg-error text-white hover:bg-error/90 transition-colors disabled:opacity-50"
                    >
                      {deleteLeg.isPending ? "Eliminando…" : "¿Confirmar?"}
                    </button>
                  </div>
                )}
                {!isGuest && otherTrips.length > 0 && (
                  <button
                    type="button"
                    title="Mover a otro viaje"
                    onClick={() => { setReassignLeg(leg); setTargetTripId("") }}
                    className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full text-on-surface-variant/50 hover:bg-surface-container hover:text-on-surface-variant transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px] leading-none">swap_horiz</span>
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {trip && !isGuest && (
        <AddLegModal
          trip={trip}
          open={modalOpen}
          onClose={handleCloseModal}
          leg={editLeg}
          expenses={expenses}
        />
      )}

      {/* Boarding pass scanner for new-leg flow */}
      {trip && bpScannerLeg && (
        <BoardingPassScanner
          tripId={id}
          leg={bpScannerLeg}
          open={true}
          onClose={() => setBpScannerLeg(null)}
          onLegUpdated={() => {
            setBpScannerLeg(null)
            refetchLegs()
          }}
        />
      )}

      {/* Reassign leg dialog */}
      {reassignLeg && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-xl">
            <h2 className="font-headline text-base font-bold text-on-surface">Reasignar tramo</h2>
            <p className="text-sm text-on-surface-variant">
              Selecciona el viaje al que quieres mover este tramo.
              {reassignLeg.expense_id && (
                <span className="block mt-1 text-amber-600 dark:text-amber-400">
                  El gasto vinculado a este tramo también se moverá al nuevo viaje.
                </span>
              )}
            </p>
            <select
              value={targetTripId}
              onChange={(e) => setTargetTripId(e.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Selecciona un viaje…</option>
              {otherTrips.map((t: Trip) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.start_date} → {t.end_date})
                </option>
              ))}
            </select>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => { setReassignLeg(null); setTargetTripId("") }}
                className="h-10 px-4 rounded-full text-sm font-label font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!targetTripId || isReassigning}
                onClick={handleReassignLeg}
                className="h-10 px-5 rounded-full text-sm font-label font-semibold text-white bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isReassigning ? "Moviendo…" : "Mover tramo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
