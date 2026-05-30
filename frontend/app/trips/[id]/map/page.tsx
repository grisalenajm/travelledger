"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { useParams, useRouter } from "next/navigation"
import { useTripMapData } from "@/hooks/use-trip-map"
import { useTrip } from "@/hooks/use-trips"

const TripMap = dynamic(() => import("@/components/trip-map"), { ssr: false })

export default function MapPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: trip } = useTrip(id)
  const { data: mapData, isLoading } = useTripMapData(id)
  const [showExpenses, setShowExpenses] = useState(true)
  const [showLegs, setShowLegs] = useState(true)

  const hasExpenses = (mapData?.expenses.length ?? 0) > 0
  const hasLegs = (mapData?.legs.length ?? 0) > 0
  const isEmpty = !hasExpenses && !hasLegs

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
          Gastos{hasExpenses ? ` (${mapData!.expenses.length})` : ""}
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
      </div>

      {/* ── Map area ── */}
      <div className="flex-1 relative">
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

        {!isLoading && !isEmpty && mapData && (
          <TripMap
            tripId={id}
            data={mapData}
            showExpenses={showExpenses}
            showLegs={showLegs}
          />
        )}
      </div>
    </div>
  )
}
