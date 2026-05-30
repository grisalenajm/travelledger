import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { api } from "@/lib/api"
import type { TripStats } from "@/types/index"

export function useTripStats(tripId: string) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: ["trips", tripId, "stats"],
    queryFn: () => api.get<TripStats>(`/api/proxy/trips/${tripId}/stats`),
    enabled: !!tripId && !!session,
  })
}
