import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { api } from "@/lib/api"
import type { FlightStats } from "@/types/index"

export function useFlightStats(period: string, year: number) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: ["stats", "flights", period, year],
    queryFn: () =>
      api.get<FlightStats>(`/api/proxy/stats/flights?period=${period}&year=${year}`),
    enabled: !!session,
  })
}
