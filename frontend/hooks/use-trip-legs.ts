import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { api } from "@/lib/api"
import type { TripLeg } from "@/types/index"
import type { TripLegCreate, TripLegUpdate, BoardingPassOcrResult } from "@/types/ledger"

export function useTripLegs(tripId: string) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: ["legs", tripId],
    queryFn: () => api.get<TripLeg[]>(`/api/proxy/trips/${tripId}/legs`),
    enabled: !!tripId && !!session,
  })
}

export function useCreateLeg(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: TripLegCreate) =>
      api.post<TripLeg>(`/api/proxy/trips/${tripId}/legs`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legs", tripId] })
      qc.invalidateQueries({ queryKey: ["trips", tripId, "summary"] })
    },
  })
}

export function useUpdateLeg(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ legId, data }: { legId: string; data: TripLegUpdate }) =>
      api.put<TripLeg>(`/api/proxy/trips/${tripId}/legs/${legId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legs", tripId] })
    },
  })
}

export function useDeleteLeg(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (legId: string) =>
      api.delete<void>(`/api/proxy/trips/${tripId}/legs/${legId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legs", tripId] })
      qc.invalidateQueries({ queryKey: ["trips", tripId, "summary"] })
    },
  })
}

export function useUploadLegDocument(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ legId, file }: { legId: string; file: File }) => {
      const form = new FormData()
      form.append("file", file)
      return api.postForm<TripLeg>(`/api/proxy/trips/${tripId}/legs/${legId}/document`, form)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legs", tripId] })
    },
  })
}

export function useScanBoardingPass(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ legId, file }: { legId: string; file: File }) => {
      const form = new FormData()
      form.append("file", file)
      return api.postForm<BoardingPassOcrResult>(
        `/api/proxy/trips/${tripId}/legs/${legId}/boarding-pass`,
        form,
      )
    },
    onSuccess: () => {
      // Refresh after document is saved by the endpoint
      qc.invalidateQueries({ queryKey: ["legs", tripId] })
    },
  })
}
