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
  const [downloading, setDownloading] = useState<"csv" | "zip" | null>(null)

  function buildUrl(type: "csv" | "zip") {
    const params = new URLSearchParams()
    if (onlyBillable) params.set("only_billable", "true")
    if (fromDate) params.set("from", fromDate)
    if (toDate) params.set("to", toDate)
    const qs = params.toString() ? `?${params.toString()}` : ""
    if (type === "csv") {
      return `/api/proxy/reports/export/${tripId}?format=csv${params.toString() ? `&${params.toString()}` : ""}`
    }
    return `/api/proxy/reports/export/${tripId}/bundle${qs}`
  }

  async function handleDownload(type: "csv" | "zip") {
    setDownloading(type)
    try {
      const res = await fetch(buildUrl(type))
      if (!res.ok) throw new Error(`Export failed: ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const date = new Date().toISOString().split("T")[0]
      a.download = type === "csv"
        ? `gastos_${tripName}_${date}.csv`
        : `bundle_${tripName}_${date}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
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
          onClick={() => handleDownload("csv")}
          disabled={downloading !== null}
          className="flex-1 sm:flex-none"
        >
          <span className="material-symbols-outlined text-sm mr-1">table_view</span>
          {downloading === "csv" ? "Descargando…" : "CSV"}
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
