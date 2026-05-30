"use client"

import { useRef, useState } from "react"
import type { TripLeg } from "@/types/index"
import type { BoardingPassOcrResult } from "@/types/ledger"
import { useScanBoardingPass, useUpdateLeg } from "@/hooks/use-trip-legs"
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

// ─── Types ───────────────────────────────────────────────

type ScanState = "idle" | "uploading" | "preview" | "error"

interface BoardingPassScannerProps {
  tripId: string
  leg: TripLeg
  open: boolean
  onClose: () => void
  onLegUpdated: () => void
}

// ─── Merge helper ────────────────────────────────────────

type OcrField = keyof Omit<BoardingPassOcrResult, "confidence">

const OCR_FIELDS: OcrField[] = [
  "origin",
  "destination",
  "departure_local",
  "arrival_local",
  "flight_number",
  "carrier",
  "seat",
  "locator_code",
]

const FIELD_LABELS: Record<OcrField, string> = {
  origin: "Origen",
  destination: "Destino",
  departure_local: "Salida",
  arrival_local: "Llegada",
  flight_number: "Vuelo",
  carrier: "Aerolínea",
  seat: "Asiento",
  locator_code: "Localizador",
}

function fmtFieldValue(field: OcrField, value: string | null): string {
  if (!value) return ""
  if (field === "departure_local" || field === "arrival_local") {
    try {
      return new Date(value).toLocaleString("es-ES", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return value
    }
  }
  return value
}

function getLegFieldValue(leg: TripLeg, field: OcrField): string | null {
  return (leg[field as keyof TripLeg] as string | null) ?? null
}

function mergeWithExistingLeg(
  existing: TripLeg,
  ocr: BoardingPassOcrResult,
): Record<string, string | null> {
  const updates: Record<string, string | null> = {}
  for (const field of OCR_FIELDS) {
    const existingVal = getLegFieldValue(existing, field)
    const ocrVal = ocr[field]
    if (!existingVal && ocrVal) {
      updates[field] = ocrVal
    }
  }
  return updates
}

// ─── Badge helpers ───────────────────────────────────────

function BadgeDetected({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-label font-semibold bg-[#d4f0d8] text-[#1a6630]">
      <span className="material-symbols-outlined text-[11px]">check_circle</span>
      {value}
    </span>
  )
}

function BadgeNotDetected() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-label font-semibold bg-surface-container text-on-surface-variant">
      <span className="material-symbols-outlined text-[11px]">remove_circle</span>
      No detectado
    </span>
  )
}

function BadgeAlreadyFilled({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-label font-semibold bg-primary/10 text-primary">
      <span className="material-symbols-outlined text-[11px]">info</span>
      Ya rellenado: {value}
    </span>
  )
}

// ─── Component ───────────────────────────────────────────

export function BoardingPassScanner({
  tripId,
  leg,
  open,
  onClose,
  onLegUpdated,
}: BoardingPassScannerProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [scanState, setScanState] = useState<ScanState>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [ocrResult, setOcrResult] = useState<BoardingPassOcrResult | null>(null)
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, string | null>>({})

  const scan = useScanBoardingPass(tripId)
  const update = useUpdateLeg(tripId)

  const handleClose = () => {
    setScanState("idle")
    setOcrResult(null)
    setPendingUpdates({})
    setErrorMsg("")
    onClose()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setScanState("uploading")
    setOcrResult(null)
    setErrorMsg("")

    try {
      const result = await scan.mutateAsync({ legId: leg.id, file })
      const updates = mergeWithExistingLeg(leg, result)
      setOcrResult(result)
      setPendingUpdates(updates)
      setScanState("preview")
    } catch (err) {
      setErrorMsg("Error procesando la tarjeta de embarque. Inténtalo de nuevo.")
      setScanState("error")
    }

    // Reset the input so the same file can be re-selected
    if (fileRef.current) fileRef.current.value = ""
  }

  const handleConfirm = async () => {
    if (Object.keys(pendingUpdates).length === 0) {
      handleClose()
      onLegUpdated()
      return
    }

    try {
      await update.mutateAsync({ legId: leg.id, data: pendingUpdates })
      onLegUpdated()
      handleClose()
    } catch {
      setErrorMsg("Error guardando los cambios. Inténtalo de nuevo.")
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">airplane_ticket</span>
          Escanear tarjeta de embarque
        </DialogTitle>
      </DialogHeader>

      {/* ── Idle state ── */}
      {scanState === "idle" && (
        <div className="space-y-4">
          <p className="text-sm text-on-surface-variant">
            Sube una foto o PDF de tu tarjeta de embarque. Haiku extraerá los datos y
            rellenará automáticamente los campos vacíos del tramo.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-outline-variant rounded-xl p-6 text-center hover:border-primary transition-colors"
          >
            <span className="material-symbols-outlined text-3xl text-on-surface-variant/60 block mb-2">
              upload_file
            </span>
            <span className="text-sm text-on-surface-variant">
              Seleccionar imagen o PDF
            </span>
          </button>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose}>Cancelar</Button>
          </DialogFooter>
        </div>
      )}

      {/* ── Uploading ── */}
      {scanState === "uploading" && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-on-surface-variant">Analizando tarjeta de embarque…</p>
        </div>
      )}

      {/* ── Preview ── */}
      {scanState === "preview" && ocrResult && (
        <div className="space-y-4">
          {/* Confidence indicator */}
          {ocrResult.confidence != null && (
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-[14px] text-primary">psychology</span>
              Confianza: {Math.round(ocrResult.confidence * 100)}%
            </div>
          )}

          {/* Field breakdown */}
          <div className="space-y-2">
            {OCR_FIELDS.map((field) => {
              const existingVal = getLegFieldValue(leg, field)
              const ocrVal = ocrResult[field]
              const label = FIELD_LABELS[field]

              return (
                <div key={field} className="flex items-center justify-between gap-2 py-1 border-b border-outline-variant/20 last:border-0">
                  <span className="text-sm text-on-surface-variant shrink-0 w-24">{label}</span>
                  {existingVal ? (
                    <BadgeAlreadyFilled value={fmtFieldValue(field, existingVal)} />
                  ) : ocrVal ? (
                    <BadgeDetected value={fmtFieldValue(field, ocrVal)} />
                  ) : (
                    <BadgeNotDetected />
                  )}
                </div>
              )
            })}
          </div>

          {/* Summary message */}
          {Object.keys(pendingUpdates).length === 0 ? (
            <p className="text-sm text-on-surface-variant bg-surface-container rounded-lg px-3 py-2">
              La imagen se ha guardado. Todos los campos ya estaban rellenados.
            </p>
          ) : (
            <p className="text-sm text-on-surface-variant">
              Se rellenarán <strong>{Object.keys(pendingUpdates).length}</strong> campo(s) vacío(s).
            </p>
          )}

          {errorMsg && (
            <p className="text-sm text-error">{errorMsg}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose}>Cancelar</Button>
            <Button type="button" onClick={handleConfirm} disabled={update.isPending}>
              {update.isPending ? "Guardando…" : "Confirmar y guardar"}
            </Button>
          </DialogFooter>
        </div>
      )}

      {/* ── Error ── */}
      {scanState === "error" && (
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
            <span className="material-symbols-outlined text-4xl text-error">error_outline</span>
            <p className="text-sm text-on-surface">{errorMsg}</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={handleFileSelect}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose}>Cancelar</Button>
            <Button type="button" onClick={() => { setScanState("idle"); setErrorMsg("") }}>
              Reintentar
            </Button>
          </DialogFooter>
        </div>
      )}
    </Dialog>
  )
}
