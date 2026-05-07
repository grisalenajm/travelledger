"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { Expense } from "@/types/index"

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
      const formData = new FormData()
      formData.append("file", file)
      formData.append("trip_id", tripId)
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
