import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { LoyaltyCard } from "@/types/ledger"
import type { LoyaltyCardCreate } from "@/types/ledger"

export function useLoyaltyCards() {
  return useQuery({
    queryKey: ["loyalty-cards"],
    queryFn: () => api.get<LoyaltyCard[]>("/api/proxy/loyalty-cards"),
  })
}

export function useCreateLoyaltyCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: LoyaltyCardCreate) =>
      api.post<LoyaltyCard>("/api/proxy/loyalty-cards", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loyalty-cards"] })
    },
  })
}

export function useDeleteLoyaltyCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/proxy/loyalty-cards/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loyalty-cards"] })
    },
  })
}
