"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import dynamic from "next/dynamic"
import { useParams, useRouter } from "next/navigation"
import { useTripMapData } from "@/hooks/use-trip-map"
import { useTrip } from "@/hooks/use-trips"
import { UnlocatedExpensesPanel } from "@/components/unlocated-expenses-panel"
import type { MapExpense, TripMapData } from "@/types/index"

const TripMap = dynamic(() => import("@/components/trip-map"), { ssr: false })

export default function MapPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: trip } = useTrip(id)
  const { data: mapData, isLoading } = useTripMapData(id)
  const [showExpenses, setShowExpenses] = useState(true)
  const [showLegs, setShowLegs] = useState(true)
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)

  // Local expenses state — synced from server, updated on drag/assign
  const [localExpenses, setLocalExpenses] = useState<MapExpense[]>([])

  useEffect(() => {
    if (mapData?.expenses) {
      setLocalExpenses(mapData.expenses)
    }
  }, [mapData?.expenses])

  const locatedExpenses = useMemo(
    () => localExpenses.filter(
      (e) => e.location_lat != null && e.location_lng != null
    ),
    [localExpenses]
  )

  const unlocatedExpenses = useMemo(
    () => localExpenses.filter(
      (e) => e.location_lat == null || e.location_lng == null
    ),
    [localExpenses]
  )

  const handleExpenseLocationUpdated = useCallback(
    (id: string, lat: number, lng: number, name: string) => {
      setLocalExpenses((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, location_lat: lat, location_lng: lng, location_name: name }
            : e
        )
      )
    },
    [],
  )

  // Map data with only located expenses (unlocated shown in panel only)
  const displayedMapData: TripMapData | undefined = mapData
    ? { ...mapData, expenses: locatedExpenses }
    : undefined

  const hasExpenses = locatedExpenses.length > 0
  const hasLegs = (mapData?.legs.length ?? 0) > 0
  const isEmpty = !hasExpenses && !hasLegs && !isLoading

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Header ── */}
      <header className="flex-shrink-0 h-14 bg-surface border-b border-outline-variant/20 flex items-center px-4 gap-3 z-10">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
          aria-label="Volver"
        >
          <span className="material-symbols-outlined text-[22px] leading-none">arrow_back</span>
        </button>
        <h1 className="flex-1 font-headline font-bold text-[15px] text-on-surface truncate">
          {trip ? `Mapa · ${trip.name}` : "Mapa"}
        </h1>
      </header>

      {/* ── Layer toggles ── */}
      <div className="flex-shrink-0 flex gap-3 px-4 py-2 bg-surface border-b border-outline-variant/10">
        <button
          type="button"
          onClick={() => setShowExpenses((v) => !v)}
          className={[
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-label font-semibold transition-colors",
            showExpenses
              ? "bg-primary text-white"
              : "bg-surface-container text-on-surface-variant",
          ].join(" ")}
        >
          <span className="material-symbols-outlined text-sm leading-none">payments</span>
          Gastos{hasExpenses ? ` (${locatedExpenses.length})` : ""}
        </button>

        <button
          type="button"
          onClick={() => setShowLegs((v) => !v)}
          className={[
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-label font-semibold transition-colors",
            showLegs
              ? "bg-secondary text-white"
              : "bg-surface-container text-on-surface-variant",
          ].join(" ")}
        >
          <span className="material-symbols-outlined text-sm leading-none">route</span>
          Itinerario{hasLegs ? ` (${mapData!.legs.length})` : ""}
        </button>

        {/* Badge gastos sin ubicar */}
        {unlocatedExpenses.length > 0 && (
          <button
            type="button"
            onClick={() => setMobilePanelOpen((v) => !v)}
            className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-label font-semibold bg-surface-container-high text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-sm leading-none">location_off</span>
            Sin ubicar ({unlocatedExpenses.length})
          </button>
        )}
      </div>

      {/* ── Map + Panel area ── */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">

        {/* Map */}
        <div className="flex-1 relative" style={{ minHeight: "300px" }}>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface z-20">
              <div className="flex flex-col items-center gap-3">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 animate-spin">
                  progress_activity
                </span>
                <p className="text-sm text-on-surface-variant">Cargando mapa…</p>
              </div>
            </div>
          )}

          {!isLoading && isEmpty && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-8">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant/30">
                map
              </span>
              <p className="font-headline text-base font-semibold text-on-surface">Sin ubicaciones</p>
              <p className="text-sm text-on-surface-variant">
                Añade una dirección a tus gastos o coordenadas a los tramos del itinerario para verlos en el mapa.
              </p>
            </div>
          )}

          {!isLoading && displayedMapData && (
            <TripMap
              tripId={id}
              data={displayedMapData}
              showExpenses={showExpenses}
              showLegs={showLegs}
              onExpenseLocationUpdated={handleExpenseLocationUpdated}
            />
          )}
        </div>

        {/* Panel lateral (desktop) */}
        {unlocatedExpenses.length > 0 && (
          <div className="hidden md:flex md:w-72 md:shrink-0 border-l border-outline-variant/20 bg-surface flex-col overflow-hidden">
            <UnlocatedExpensesPanel
              expenses={unlocatedExpenses}
              onLocationAssigned={handleExpenseLocationUpdated}
            />
          </div>
        )}

        {/* Panel móvil expandible */}
        {unlocatedExpenses.length > 0 && mobilePanelOpen && (
          <div className="md:hidden border-t border-outline-variant/20 bg-surface flex flex-col overflow-hidden"
               style={{ maxHeight: "45vh" }}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-outline-variant/10 shrink-0">
              <span className="text-sm font-semibold text-on-surface">
                Sin ubicación ({unlocatedExpenses.length})
              </span>
              <button
                type="button"
                onClick={() => setMobilePanelOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[18px] leading-none">close</span>
              </button>
            </div>
            <UnlocatedExpensesPanel
              expenses={unlocatedExpenses}
              onLocationAssigned={(id, lat, lng, name) => {
                handleExpenseLocationUpdated(id, lat, lng, name)
                if (unlocatedExpenses.length <= 1) setMobilePanelOpen(false)
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
