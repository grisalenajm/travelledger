import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { api } from "@/lib/api"

export interface CurrencyOption {
  code: string
  name: string
}

export function useCurrencies() {
  const { data: session } = useSession()
  return useQuery({
    queryKey: ["currencies", "list"],
    queryFn: () => api.get<CurrencyOption[]>("/api/proxy/currencies/list"),
    enabled: !!session,
    staleTime: 24 * 60 * 60 * 1000, // 24h — la lista solo cambia con un deploy
  })
}
