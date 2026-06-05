"use client"

import { useState } from "react"
import { LocationAutocomplete, type PlaceResult } from "@/components/location-autocomplete"
import { Button } from "@/components/ui/button"
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { MapExpense } from "@/types/index"

const CATEGORY_EMOJI: Record<string, string> = {
  Dining: "🍽️",
  Lodging: "🏨",
  Transport: "🚇",
  Culture: "🎭",
  Shopping: "🛍️",
  Health: "💊",
  Other: "📦",
}

interface Props {
  expenses: MapExpense[]
  onLocationAssigned: (id: string, lat: number, lng: number, name: string) => void
}

export function UnlocatedExpensesPanel({ expenses, onLocationAssigned }: Props) {
  const [selectedExpense, setSelectedExpense] = useState<MapExpense | null>(null)
  const [locationInput, setLocationInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [pendingPlace, setPendingPlace] = useState<PlaceResult | null>(null)

  const handleOpenDialog = (expense: MapExpense) => {
    setSelectedExpense(expense)
    setLocationInput("")
    setPendingPlace(null)
  }

  const handleClose = () => setSelectedExpense(null)

  const handleAssign = async () => {
    if (!selectedExpense || !pendingPlace) return
    setSaving(true)
    try {
      const res = await fetch(`/api/proxy/expenses/${selectedExpense.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_name: pendingPlace.name,
          location_lat: pendingPlace.lat,
          location_lng: pendingPlace.lng,
        }),
      })
      if (!res.ok) throw new Error("PUT failed")
      onLocationAssigned(selectedExpense.id, pendingPlace.lat, pendingPlace.lng, pendingPlace.name)
      handleClose()
    } catch {
      // error handled silently — user can retry
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Header */}
      <div className="p-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant leading-none">
            location_off
          </span>
          <h3 className="font-semibold text-sm text-on-surface">Sin ubicación</h3>
        </div>
        <p className="text-xs text-on-surface-variant mt-1">
          {expenses.length} gasto{expenses.length !== 1 ? "s" : ""} sin coordenadas
        </p>
      </div>

      {/* Lista */}
      <div className="overflow-y-auto flex-1 divide-y divide-outline-variant/10">
        {expenses.map((expense) => (
          <div
            key={expense.id}
            className="p-3 hover:bg-surface-container/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <span className="text-lg shrink-0 leading-none mt-0.5" aria-hidden>
                  {CATEGORY_EMOJI[expense.category] ?? "📦"}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate leading-tight">
                    {expense.description || expense.category}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {expense.currency} {Number(expense.amount).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                    {" · "}
                    {expense.date}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
                onClick={() => handleOpenDialog(expense)}
                title="Asignar ubicación"
              >
                <span className="material-symbols-outlined text-[18px] leading-none">
                  add_location
                </span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Dialog de asignación */}
      <Dialog
        open={selectedExpense != null}
        onClose={handleClose}
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Asignar ubicación</DialogTitle>
        </DialogHeader>
        {selectedExpense && (
          <p className="text-sm text-on-surface-variant -mt-3 mb-4">
            {selectedExpense.description || selectedExpense.category}
            {" · "}
            {selectedExpense.currency} {Number(selectedExpense.amount).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
          </p>
        )}

        <div className="mb-4">
          <LocationAutocomplete
            value={locationInput}
            onChange={setLocationInput}
            onSelect={(place) => {
              setLocationInput(place.name)
              setPendingPlace(place)
            }}
            placeholder="Busca restaurante, hotel, ciudad..."
            type="business"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleAssign} disabled={saving || !pendingPlace}>
            {saving ? "Guardando…" : "Asignar"}
          </Button>
        </div>
      </Dialog>
    </>
  )
}
