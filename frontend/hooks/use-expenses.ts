import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Expense, ExpenseCreate, ExpenseUpdate } from "@/types/ledger"

export function useExpenses(tripId: string) {
  return useQuery({
    queryKey: ["expenses", tripId],
    queryFn: () => api.get<Expense[]>(`/api/proxy/expenses?trip_id=${tripId}`),
    enabled: !!tripId,
  })
}

export function useRecentExpenses(limit = 10) {
  return useQuery({
    queryKey: ["expenses", "recent", limit],
    queryFn: () => api.get<Expense[]>(`/api/proxy/expenses?limit=${limit}`),
  })
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ExpenseCreate) => api.post<Expense>("/api/proxy/expenses", data),
    onSuccess: (expense) => {
      qc.invalidateQueries({ queryKey: ["expenses", expense.trip_id] })
      qc.invalidateQueries({ queryKey: ["trips", expense.trip_id, "summary"] })
    },
  })
}

export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ExpenseUpdate; tripId: string }) =>
      api.put<Expense>(`/api/proxy/expenses/${id}`, data),
    onSuccess: (expense) => {
      qc.invalidateQueries({ queryKey: ["expenses", expense.trip_id] })
      qc.invalidateQueries({ queryKey: ["trips", expense.trip_id, "summary"] })
    },
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; tripId: string }) =>
      api.delete<void>(`/api/proxy/expenses/${id}`),
    onSuccess: (_data, { tripId }) => {
      qc.invalidateQueries({ queryKey: ["expenses", tripId] })
      qc.invalidateQueries({ queryKey: ["trips", tripId, "summary"] })
    },
  })
}
