"use client"

import { useState } from "react"
import type { Expense } from "@/types/index"

export function useReceiptUpload() {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File, tripId: string): Promise<Expense | null> => {
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
      return (await res.json()) as Expense
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
      return null
    } finally {
      setIsUploading(false)
    }
  }

  return { upload, isUploading, error }
}
