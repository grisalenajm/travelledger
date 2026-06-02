"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { Expense } from "@/types/index"

async function readExifGps(file: File): Promise<{ lat: number; lng: number } | null> {
  if (!file.type.startsWith("image/")) return null
  try {
    const exifr = await import("exifr")
    // exifr.gps() returns undefined when no GPS data, despite the type declaration
    const gps = (await exifr.gps(file)) as { latitude: number; longitude: number } | undefined
    if (gps?.latitude != null && gps?.longitude != null) {
      return { lat: gps.latitude, lng: gps.longitude }
    }
  } catch {
    // No GPS data or exifr error — continue without coords
  }
  return null
}

export function useUploadReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      file,
      tripId,
    }: {
      file: File
      tripId: string
    }): Promise<Expense> => {
      const gps = await readExifGps(file)

      const formData = new FormData()
      formData.append("file", file)
      formData.append("trip_id", tripId)
      if (gps) {
        formData.append("exif_lat", String(gps.lat))
        formData.append("exif_lng", String(gps.lng))
      }

      const res = await fetch("/api/proxy/receipts/upload", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<Expense>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] })
    },
  })
}
