import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { api } from "@/lib/api"
import type { GlobalStats } from "@/types/index"

export function useGlobalStats(period: string, year: number) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: ["stats", "global", period, year],
    queryFn: () =>
      api.get<GlobalStats>(`/api/proxy/stats/global?period=${period}&year=${year}`),
    enabled: !!session,
  })
}
