"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useTrip } from "@/hooks/use-trips"
import { useExpenses } from "@/hooks/use-expenses"
import { useTripLegs, useDeleteLeg, useCreateLeg } from "@/hooks/use-trip-legs"
import { LegCard } from "@/components/leg-card"
import { AddLegModal } from "@/components/add-leg-modal"
import { BoardingPassScanner } from "@/components/boarding-pass-scanner"
import { Button } from "@/components/ui/button"
import { useIsGuest } from "@/hooks/use-is-guest"
import type { TripLeg, LegMode } from "@/types/index"

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
  const [filter, setFilter] = useState<FilterMode>("all")
  const [modalOpen, setModalOpen] = useState(false)
  const [editLeg, setEditLeg] = useState<TripLeg | undefined>()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bpScannerLeg, setBpScannerLeg] = useState<TripLeg | null>(null)
  const [bpCreating, setBpCreating] = useState(false)

  const { data: trip, isLoading: tripLoading } = useTrip(id)
  const { data: legs, isLoading: legsLoading, refetch: refetchLegs } = useTripLegs(id)
  const { data: expenses } = useExpenses(id)
  const deleteLeg = useDeleteLeg(id)
  const createLeg = useCreateLeg(id)
  const isGuest = useIsGuest()

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
    </main>
  )
}
