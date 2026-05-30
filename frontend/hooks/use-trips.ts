import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { api } from "@/lib/api"
import type { Trip, TripSummary, TripStatus } from "@/types/ledger"
import type { TripCreate } from "@/types/ledger"

/**
 * Devuelve el viaje activo de hoy (start_date ≤ hoy ≤ end_date, status=active).
 * null si no hay ninguno activo.
 */
export function useActiveTrip() {
  const { data: session } = useSession()
  return useQuery({
    queryKey: ["trips", "active"],
    queryFn: () => api.get<Trip | null>("/api/proxy/trips/active"),
    enabled: !!session,
    staleTime: 60_000,
  })
}

export function useTrips(status?: TripStatus) {
  const { data: session } = useSession()
  const params = status ? `?status=${status}` : ""
  return useQuery({
    queryKey: ["trips", status ?? "all"],
    queryFn: () => api.get<Trip[]>(`/api/proxy/trips${params}`),
    enabled: !!session, // BEST_PRACTICES — evita fetch sin sesión activa
  })
}

export function useTrip(id: string) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: ["trips", id],
    queryFn: () => api.get<Trip>(`/api/proxy/trips/${id}`),
    enabled: !!id && !!session,
  })
}

export function useTripSummary(id: string) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: ["trips", id, "summary"],
    queryFn: () => api.get<TripSummary>(`/api/proxy/trips/${id}/summary`),
    enabled: !!id && !!session,
  })
}

export function useCreateTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: TripCreate) => api.post<Trip>("/api/proxy/trips", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trips"] })
    },
  })
}

export function useUpdateTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TripCreate> }) =>
      api.put<Trip>(`/api/proxy/trips/${id}`, data),
    onSuccess: (trip) => {
      qc.invalidateQueries({ queryKey: ["trips"] })
      qc.setQueryData(["trips", trip.id], trip)
    },
  })
}

export function useDeleteTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/proxy/trips/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trips"] })
    },
  })
}
