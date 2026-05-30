import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { api } from "@/lib/api"
import type { TripMapData } from "@/types/index"

export function useTripMapData(tripId: string) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: ["trips", tripId, "map-data"],
    queryFn: () => api.get<TripMapData>(`/api/proxy/trips/${tripId}/map-data`),
    enabled: !!tripId && !!session,
  })
}

export function useGeocodeExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ expenseId, tripId }: { expenseId: string; tripId: string }) =>
      api.post(`/api/proxy/expenses/${expenseId}/geocode`, {}),
    onSuccess: (_data, { tripId }) => {
      qc.invalidateQueries({ queryKey: ["trips", tripId, "map-data"] })
      qc.invalidateQueries({ queryKey: ["expenses", tripId] })
    },
  })
}
