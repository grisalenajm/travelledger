"use client"

import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import type { Trip, TripLeg, LegMode, Expense } from "@/types/index"
import type { TripLegCreate } from "@/types/ledger"
import { useCreateLeg, useUpdateLeg, useUploadLegDocument } from "@/hooks/use-trip-legs"
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { IataInput } from "@/components/iata-input"
import { BoardingPassScanner } from "@/components/boarding-pass-scanner"
import { AirlineAutocomplete } from "@/components/airline-autocomplete"
import { HotelAutocomplete } from "@/components/hotel-autocomplete"
import { LocationAutocomplete } from "@/components/location-autocomplete"

const INPUT_CLASS =
  "mt-1 block w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"

const MODES: { value: LegMode; label: string; icon: string }[] = [
  { value: "flight", label: "Vuelo", icon: "flight" },
  { value: "accommodation", label: "Alojamiento", icon: "hotel" },
  { value: "car_rental", label: "Coche", icon: "car_rental" },
  { value: "train", label: "Tren", icon: "train" },
  { value: "bus", label: "Bus", icon: "directions_bus" },
  { value: "ferry", label: "Ferry", icon: "directions_boat" },
  { value: "other", label: "Otro", icon: "directions" },
]

interface AddLegModalProps {
  trip: Trip
  open: boolean
  onClose: () => void
  leg?: TripLeg
  expenses?: Expense[]
}

export function AddLegModal({ trip, open, onClose, leg, expenses }: AddLegModalProps) {
  const isEdit = !!leg
  const createLeg = useCreateLeg(trip.id)
  const updateLeg = useUpdateLeg(trip.id)
  const uploadDoc = useUploadLegDocument(trip.id)

  const [mode, setMode] = useState<LegMode>(leg?.mode ?? "flight")
  const [docFile, setDocFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [showBoardingPassScanner, setShowBoardingPassScanner] = useState(false)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<TripLegCreate>({
    defaultValues: _defaultValues(leg),
  })

  useEffect(() => {
    if (open) {
      setMode(leg?.mode ?? "flight")
      setDocFile(null)
      reset(_defaultValues(leg))
    }
  }, [open, leg?.id])  // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (values: TripLegCreate) => {
    const rawPayload = { ...values, mode, expense_id: values.expense_id || null }
    // Strip empty strings and undefined so the backend doesn't receive "" for optional datetime/numeric fields
    const payload = Object.fromEntries(
      Object.entries(rawPayload).filter(([, v]) => v !== "" && v !== undefined)
    ) as unknown as TripLegCreate
    try {
      let saved: TripLeg
      if (isEdit && leg) {
        saved = await updateLeg.mutateAsync({ legId: leg.id, data: payload })
      } else {
        saved = await createLeg.mutateAsync(payload)
      }
      if (docFile) {
        await uploadDoc.mutateAsync({ legId: saved.id, file: docFile })
      }
      reset()
      setDocFile(null)
      onClose()
    } catch (err) {
      console.error("Error guardando leg:", err)
    }
  }

  const isPending = createLeg.isPending || updateLeg.isPending || uploadDoc.isPending

  return (
    <>
    {/* Boarding pass scanner — rendered outside the main dialog to avoid nesting issues */}
    {isEdit && leg && (
      <BoardingPassScanner
        tripId={trip.id}
        leg={leg}
        open={showBoardingPassScanner}
        onClose={() => setShowBoardingPassScanner(false)}
        onLegUpdated={() => {
          setShowBoardingPassScanner(false)
          onClose()
        }}
      />
    )}

    <Dialog open={open} onClose={onClose} className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Editar tramo" : "Nuevo tramo"} — {trip.name}</DialogTitle>
      </DialogHeader>

      {/* Mode selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            className={[
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-label font-semibold transition-colors",
              mode === m.value
                ? "bg-primary text-white"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high",
            ].join(" ")}
          >
            <span className="material-symbols-outlined text-[14px]">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* ── Transport (flight | train | bus | ferry | other) ── */}
        {isTransport(mode) && (
          <>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="origin">Origen</Label>
                {mode === "flight" ? (
                  <IataInput
                    id="origin"
                    value={watch("origin") ?? ""}
                    onChange={(v) => setValue("origin", v)}
                    onSelectAirport={(a) => {
                      setValue("origin_lat", a.lat)
                      setValue("origin_lng", a.lng)
                    }}
                    placeholder="MAD"
                    className={INPUT_CLASS}
                  />
                ) : (
                  <LocationAutocomplete
                    value={watch("origin") ?? ""}
                    onChange={(v) => setValue("origin", v)}
                    onSelect={(place) => {
                      setValue("origin", place.name)
                      setValue("origin_lat", place.lat)
                      setValue("origin_lng", place.lng)
                    }}
                    type="city"
                    placeholder="Madrid"
                    className={INPUT_CLASS}
                  />
                )}
              </div>
              <div className="flex-1">
                <Label htmlFor="destination">Destino</Label>
                {mode === "flight" ? (
                  <IataInput
                    id="destination"
                    value={watch("destination") ?? ""}
                    onChange={(v) => setValue("destination", v)}
                    onSelectAirport={(a) => {
                      setValue("destination_lat", a.lat)
                      setValue("destination_lng", a.lng)
                    }}
                    placeholder="BCN"
                    className={INPUT_CLASS}
                  />
                ) : (
                  <LocationAutocomplete
                    value={watch("destination") ?? ""}
                    onChange={(v) => setValue("destination", v)}
                    onSelect={(place) => {
                      setValue("destination", place.name)
                      setValue("destination_lat", place.lat)
                      setValue("destination_lng", place.lng)
                    }}
                    type="city"
                    placeholder="Barcelona"
                    className={INPUT_CLASS}
                  />
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="departure_local">Salida</Label>
                <input id="departure_local" type="datetime-local" className={INPUT_CLASS} {...register("departure_local")} />
              </div>
              <div className="flex-1">
                <Label htmlFor="arrival_local">Llegada</Label>
                <input id="arrival_local" type="datetime-local" className={INPUT_CLASS} {...register("arrival_local")} />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="carrier">Compañía</Label>
                {mode === "flight" ? (
                  <AirlineAutocomplete
                    value={watch("carrier") ?? ""}
                    onChange={(val) => setValue("carrier", val)}
                    className={INPUT_CLASS}
                    placeholder="Iberia, IB…"
                  />
                ) : (
                  <input id="carrier" type="text" placeholder="Iberia" className={INPUT_CLASS} {...register("carrier")} />
                )}
              </div>
              {mode === "flight" && (
                <div className="w-32">
                  <Label htmlFor="flight_number">Vuelo</Label>
                  <input id="flight_number" type="text" placeholder="IB1234" className={INPUT_CLASS} {...register("flight_number")} />
                </div>
              )}
            </div>
            {mode === "flight" && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label htmlFor="seat">Asiento</Label>
                  <input id="seat" type="text" placeholder="12A" className={INPUT_CLASS} {...register("seat")} />
                </div>
                <div className="flex-1">
                  <Label htmlFor="locator_code">Localizador</Label>
                  <input id="locator_code" type="text" placeholder="ABC123" className={INPUT_CLASS} {...register("locator_code")} />
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="reservation_number">Reserva</Label>
              <input id="reservation_number" type="text" className={INPUT_CLASS} {...register("reservation_number")} />
            </div>
          </>
        )}

        {/* ── Accommodation ── */}
        {mode === "accommodation" && (
          <>
            <div>
              <Label htmlFor="accommodation_name">Hotel / Alojamiento</Label>
              <HotelAutocomplete
                value={watch("accommodation_name") ?? ""}
                onChange={(v) => setValue("accommodation_name", v)}
                onSelect={(hotel) => {
                  setValue("accommodation_name", hotel.name)
                  setValue("accommodation_address", hotel.display)
                  setValue("accommodation_lat", hotel.lat)
                  setValue("accommodation_lng", hotel.lng)
                }}
                placeholder="Hotel Arts Barcelona..."
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <Label htmlFor="accommodation_address">Dirección</Label>
              <input id="accommodation_address" type="text" className={INPUT_CLASS} {...register("accommodation_address")} />
            </div>
            <div>
              <Label htmlFor="accommodation_provider">Plataforma / Cadena</Label>
              <input id="accommodation_provider" type="text" placeholder="Booking.com" className={INPUT_CLASS} {...register("accommodation_provider")} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="check_in">Check-in</Label>
                <input id="check_in" type="datetime-local" className={INPUT_CLASS} {...register("check_in")} />
              </div>
              <div className="flex-1">
                <Label htmlFor="check_out">Check-out</Label>
                <input id="check_out" type="datetime-local" className={INPUT_CLASS} {...register("check_out")} />
              </div>
            </div>
            <div>
              <Label htmlFor="reservation_number">Número de reserva</Label>
              <input id="reservation_number" type="text" className={INPUT_CLASS} {...register("reservation_number")} />
            </div>
          </>
        )}

        {/* ── Car rental ── */}
        {mode === "car_rental" && (
          <>
            <div>
              <Label htmlFor="rental_company">Empresa de alquiler</Label>
              <input id="rental_company" type="text" placeholder="Hertz" className={INPUT_CLASS} {...register("rental_company")} />
            </div>
            <div>
              <Label htmlFor="pickup_location">Lugar de recogida</Label>
              <LocationAutocomplete
                value={watch("pickup_location") ?? ""}
                onChange={(v) => setValue("pickup_location", v)}
                onSelect={(place) => {
                  setValue("pickup_location", place.name)
                  setValue("pickup_lat", place.lat)
                  setValue("pickup_lng", place.lng)
                }}
                type="city"
                placeholder="Aeropuerto, ciudad..."
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <Label htmlFor="dropoff_location">Lugar de entrega</Label>
              <LocationAutocomplete
                value={watch("dropoff_location") ?? ""}
                onChange={(v) => setValue("dropoff_location", v)}
                onSelect={(place) => {
                  setValue("dropoff_location", place.name)
                  setValue("dropoff_lat", place.lat)
                  setValue("dropoff_lng", place.lng)
                }}
                type="city"
                placeholder="Aeropuerto, ciudad..."
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="pickup_datetime">Recogida</Label>
                <input id="pickup_datetime" type="datetime-local" className={INPUT_CLASS} {...register("pickup_datetime")} />
              </div>
              <div className="flex-1">
                <Label htmlFor="dropoff_datetime">Entrega</Label>
                <input id="dropoff_datetime" type="datetime-local" className={INPUT_CLASS} {...register("dropoff_datetime")} />
              </div>
            </div>
            <div>
              <Label htmlFor="confirmation_number">Número de confirmación</Label>
              <input id="confirmation_number" type="text" className={INPUT_CLASS} {...register("confirmation_number")} />
            </div>
          </>
        )}

        {/* ── Boarding pass OCR (only for existing flight legs) ── */}
        {isEdit && leg && mode === "flight" && (
          <div className="pt-3 border-t border-outline-variant/20">
            <Label className="block mb-1.5">Tarjeta de embarque</Label>
            <button
              type="button"
              onClick={() => setShowBoardingPassScanner(true)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-primary">airplane_ticket</span>
              <span className="text-sm font-medium">
                {leg.has_document ? "Reemplazar tarjeta de embarque" : "Escanear tarjeta de embarque"}
              </span>
            </button>
          </div>
        )}

        {/* ── Common: notes ── */}
        <div>
          <Label htmlFor="notes">Notas</Label>
          <input id="notes" type="text" placeholder="Opcional" className={INPUT_CLASS} {...register("notes")} />
        </div>

        {/* ── I4: link expense ── */}
        {expenses && expenses.length > 0 && (
          <div>
            <Label htmlFor="expense_id">Vincular gasto</Label>
            <select id="expense_id" className={INPUT_CLASS} {...register("expense_id")}>
              <option value="">— Sin vincular —</option>
              {expenses.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.date} · {e.description || e.category} · {Number(e.amount).toFixed(2)} {e.currency}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ── I4: document upload ── */}
        <div>
          <Label>Documento adjunto</Label>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
          />
          {!docFile ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-1 w-full border-2 border-dashed border-outline-variant rounded-lg p-3 text-center text-sm text-on-surface-variant hover:border-primary transition-colors"
            >
              <span className="material-symbols-outlined text-base align-middle mr-1">attach_file</span>
              {leg?.has_document ? "Reemplazar documento" : "Adjuntar documento"}
            </button>
          ) : (
            <div className="mt-1 flex items-center gap-3 border border-outline-variant rounded-lg px-3 py-2">
              <span className="material-symbols-outlined text-primary">description</span>
              <span className="text-sm flex-1 truncate">{docFile.name}</span>
              <button
                type="button"
                onClick={() => setDocFile(null)}
                className="text-on-surface-variant hover:text-error"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Guardando…" : isEdit ? "Actualizar" : "Guardar tramo"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
    </>
  )
}

function isTransport(mode: LegMode) {
  return mode === "flight" || mode === "train" || mode === "bus" || mode === "ferry" || mode === "other"
}

function _defaultValues(leg?: TripLeg): TripLegCreate {
  if (!leg) return { mode: "flight" }
  return {
    mode: leg.mode,
    notes: leg.notes,
    expense_id: leg.expense_id,
    origin: leg.origin,
    destination: leg.destination,
    departure_local: leg.departure_local?.slice(0, 16) ?? undefined,
    arrival_local: leg.arrival_local?.slice(0, 16) ?? undefined,
    carrier: leg.carrier,
    flight_number: leg.flight_number,
    reservation_number: leg.reservation_number,
    locator_code: leg.locator_code,
    seat: leg.seat,
    loyalty_card_id: leg.loyalty_card_id,
    accommodation_name: leg.accommodation_name,
    accommodation_address: leg.accommodation_address,
    accommodation_provider: leg.accommodation_provider,
    check_in: leg.check_in?.slice(0, 16) ?? undefined,
    check_out: leg.check_out?.slice(0, 16) ?? undefined,
    rental_company: leg.rental_company,
    pickup_location: leg.pickup_location,
    dropoff_location: leg.dropoff_location,
    pickup_datetime: leg.pickup_datetime?.slice(0, 16) ?? undefined,
    dropoff_datetime: leg.dropoff_datetime?.slice(0, 16) ?? undefined,
    confirmation_number: leg.confirmation_number,
  }
}
