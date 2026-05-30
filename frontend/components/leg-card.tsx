"use client"

import { useEffect, useState } from "react"
import type { TripLeg, LegMode } from "@/types/index"
import { AirlineLogo } from "@/components/airline-logo"
import { getIataByName } from "@/lib/airlines-lookup"

function fmtDateTime(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  })
}

const MODE_ICON: Record<LegMode, string> = {
  flight: "flight",
  train: "train",
  bus: "directions_bus",
  ferry: "directions_boat",
  accommodation: "hotel",
  car_rental: "car_rental",
  other: "directions",
}

const MODE_LABEL: Record<LegMode, string> = {
  flight: "Vuelo",
  train: "Tren",
  bus: "Bus",
  ferry: "Ferry",
  accommodation: "Alojamiento",
  car_rental: "Coche de alquiler",
  other: "Otro",
}

interface LegCardProps {
  leg: TripLeg
  onEdit?: (leg: TripLeg) => void
  onDelete?: (leg: TripLeg) => void
}

export function LegCard({ leg, onEdit, onDelete }: LegCardProps) {
  return (
    <div className="rounded-xl bg-surface-container-lowest px-4 py-3 shadow-editorial">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-[18px] text-primary">
            {MODE_ICON[leg.mode] ?? "directions"}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant">
              {MODE_LABEL[leg.mode]}
            </span>
            {leg.has_document && (
              <span
                className="material-symbols-outlined text-[12px] text-on-surface-variant"
                title="Documento adjunto"
              >
                attach_file
              </span>
            )}
            {leg.expense_id && (
              <span
                className="material-symbols-outlined text-[12px] text-primary"
                title="Gasto vinculado"
              >
                receipt
              </span>
            )}
          </div>

          {isTransport(leg.mode) && <TransportContent leg={leg} />}
          {leg.mode === "accommodation" && <AccommodationContent leg={leg} />}
          {leg.mode === "car_rental" && <CarRentalContent leg={leg} />}

          {leg.notes && (
            <p className="mt-1 text-xs text-on-surface-variant truncate">{leg.notes}</p>
          )}
        </div>

        {(onEdit || onDelete) && (
          <div className="flex-shrink-0 flex items-center gap-0.5">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(leg)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
                aria-label="Editar tramo"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(leg)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container hover:text-error transition-colors"
                aria-label="Eliminar tramo"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function isTransport(mode: LegMode) {
  return mode === "flight" || mode === "train" || mode === "bus" || mode === "ferry" || mode === "other"
}

function TransportContent({ leg }: { leg: TripLeg }) {
  const [carrierIata, setCarrierIata] = useState<string | null>(null)

  useEffect(() => {
    if (leg.mode === "flight" && leg.carrier) {
      getIataByName(leg.carrier).then((iata) => setCarrierIata(iata))
    }
  }, [leg.mode, leg.carrier])

  return (
    <>
      <div className="mt-0.5 flex items-center gap-2">
        <span className="text-sm font-semibold text-on-surface">{leg.origin ?? "—"}</span>
        <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
          arrow_forward
        </span>
        <span className="text-sm font-semibold text-on-surface">{leg.destination ?? "—"}</span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <span className="text-xs text-on-surface-variant">{fmtDateTime(leg.departure_local)}</span>
        {leg.carrier && (
          <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
            {leg.mode === "flight" && carrierIata && (
              <AirlineLogo iata={carrierIata} name={leg.carrier} size={18} />
            )}
            {leg.carrier}
          </span>
        )}
        {leg.flight_number && (
          <span className="text-xs text-on-surface-variant font-mono">{leg.flight_number}</span>
        )}
        {leg.distance_km != null && (
          <span className="text-xs text-on-surface-variant">
            {Number(leg.distance_km).toFixed(0)} km
          </span>
        )}
      </div>
    </>
  )
}

function AccommodationContent({ leg }: { leg: TripLeg }) {
  return (
    <>
      <p className="mt-0.5 text-sm font-semibold text-on-surface truncate">
        {leg.accommodation_name ?? "Alojamiento"}
      </p>
      {leg.accommodation_address && (
        <p className="text-xs text-on-surface-variant truncate">{leg.accommodation_address}</p>
      )}
      <div className="mt-0.5 flex gap-x-3 text-xs text-on-surface-variant">
        <span>Entrada: {fmtDate(leg.check_in)}</span>
        <span>Salida: {fmtDate(leg.check_out)}</span>
      </div>
    </>
  )
}

function CarRentalContent({ leg }: { leg: TripLeg }) {
  return (
    <>
      <p className="mt-0.5 text-sm font-semibold text-on-surface">
        {leg.rental_company ?? "Coche de alquiler"}
      </p>
      {leg.pickup_location && (
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-[12px]">location_on</span>
          <span className="truncate">{leg.pickup_location}</span>
        </div>
      )}
      {leg.pickup_datetime && (
        <p className="text-xs text-on-surface-variant">
          {fmtDateTime(leg.pickup_datetime)}
          {leg.dropoff_datetime && ` → ${fmtDateTime(leg.dropoff_datetime)}`}
        </p>
      )}
    </>
  )
}
