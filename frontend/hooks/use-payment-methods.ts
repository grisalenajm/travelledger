import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { api } from "@/lib/api"

export interface PaymentMethodItem {
  id: string
  name: string
}

export function usePaymentMethods() {
  const { data: session } = useSession()
  return useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => api.get<PaymentMethodItem[]>("/api/proxy/payment-methods"),
    enabled: !!session,
  })
}

export function useCreatePaymentMethod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      api.post<PaymentMethodItem>("/api/proxy/payment-methods", { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment-methods"] }),
  })
}

export function useDeletePaymentMethod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/proxy/payment-methods/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment-methods"] }),
  })
}
