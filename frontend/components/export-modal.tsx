"use client"

import { useState } from "react"
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"

interface ExportModalProps {
  open: boolean
  onClose: () => void
  tripId: string
  tripName: string
}

export function ExportModal({ open, onClose, tripId, tripName }: ExportModalProps) {
  const [onlyBillable, setOnlyBillable] = useState(true)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [exportFormat, setExportFormat] = useState<"xlsx" | "csv">("xlsx")
  const [downloading, setDownloading] = useState<"data" | "zip" | null>(null)

  function buildParams(includeFormat = true) {
    const params = new URLSearchParams()
    if (includeFormat) params.set("format", exportFormat)
    if (onlyBillable) params.set("only_billable", "true")
    if (fromDate) params.set("from", fromDate)
    if (toDate) params.set("to", toDate)
    return params.toString()
  }

  async function handleDownload(type: "data" | "zip") {
    setDownloading(type)
    try {
      const qs = buildParams()
      const url =
        type === "zip"
          ? `/api/proxy/reports/export/${tripId}/bundle?${qs}`
          : `/api/proxy/reports/export/${tripId}?${qs}`

      const res = await fetch(url)
      if (!res.ok) throw new Error(`Export failed: ${res.status}`)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      const dateStr = new Date().toISOString().split("T")[0]
      if (type === "zip") {
        a.download = `bundle_${tripName}_${dateStr}.zip`
      } else {
        a.download = `gastos_${tripName}_${dateStr}.${exportFormat}`
      }
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (e) {
      console.error("Export failed", e)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Exportar gastos</DialogTitle>
      </DialogHeader>

      <div className="space-y-5">
        {/* Format selector */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">
            Formato
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setExportFormat("xlsx")}
              className={[
                "flex-1 py-2 rounded-lg text-sm font-label font-semibold border transition-colors",
                exportFormat === "xlsx"
                  ? "bg-primary text-white border-primary"
                  : "bg-surface border-outline-variant text-on-surface-variant hover:bg-surface-container",
              ].join(" ")}
            >
              <span className="material-symbols-outlined text-sm align-middle mr-1">grid_on</span>
              Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => setExportFormat("csv")}
              className={[
                "flex-1 py-2 rounded-lg text-sm font-label font-semibold border transition-colors",
                exportFormat === "csv"
                  ? "bg-primary text-white border-primary"
                  : "bg-surface border-outline-variant text-on-surface-variant hover:bg-surface-container",
              ].join(" ")}
            >
              <span className="material-symbols-outlined text-sm align-middle mr-1">table_view</span>
              CSV
            </button>
          </div>
          {exportFormat === "csv" && (
            <p className="text-[11px] text-on-surface-variant">
              Separador <code className="bg-surface-container px-1 rounded">;</code> · decimal <code className="bg-surface-container px-1 rounded">,</code> · compatible con Excel en español
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <label htmlFor="only-billable" className="text-sm text-on-surface cursor-pointer select-none">
            Solo facturables
          </label>
          <Switch
            id="only-billable"
            checked={onlyBillable}
            onCheckedChange={setOnlyBillable}
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">
            Rango de fechas (opcional)
          </p>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="flex-1 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <span className="text-xs text-on-surface-variant">–</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="flex-1 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      </div>

      <DialogFooter className="flex-col sm:flex-row gap-2 mt-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDownload("data")}
          disabled={downloading !== null}
          className="flex-1 sm:flex-none"
        >
          <span className="material-symbols-outlined text-sm mr-1">
            {exportFormat === "xlsx" ? "grid_on" : "table_view"}
          </span>
          {downloading === "data"
            ? "Descargando…"
            : exportFormat === "xlsx"
            ? "Descargar Excel"
            : "Descargar CSV"}
        </Button>
        <Button
          size="sm"
          onClick={() => handleDownload("zip")}
          disabled={downloading !== null}
          className="flex-1 sm:flex-none"
        >
          <span className="material-symbols-outlined text-sm mr-1">folder_zip</span>
          {downloading === "zip" ? "Descargando…" : "ZIP con imágenes"}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
