"use client"

import { useState } from "react"
import type { Expense } from "@/types/index"
import { toast } from "@/hooks/use-toast"

export function useReceiptUpload() {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File, tripId: string): Promise<Expense | null> {
    setIsUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("trip_id", tripId)
      // NO fijar Content-Type — fetch lo pone con boundary automáticamente
      const res = await fetch("/api/proxy/receipts/upload", {
        method: "POST",
        body: fd,
      })
      if (!res.ok) throw new Error("Error al analizar la factura")

      const warning = res.headers.get("X-Paperless-Warning")
      const expense = (await res.json()) as Expense

      if (warning === "duplicate") {
        toast.warning(
          "Esta factura ya existe en Paperless. El gasto se ha creado sin imagen vinculada.",
        )
      }

      return expense
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
      return null
    } finally {
      setIsUploading(false)
    }
  }

  return { upload, isUploading, error }
}
