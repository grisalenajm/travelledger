import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"

import { api } from "@/lib/api"
import type { Notification, NotificationCount } from "@/types"

export function useNotificationCount() {
  const { data: session } = useSession()
  return useQuery({
    queryKey: ["notifications", "count"],
    queryFn: () => api.get<NotificationCount>("/api/proxy/notifications/count"),
    refetchInterval: 60_000,
    enabled: !!session, // CRÍTICO: no hacer fetch sin sesión activa
  })
}

export function useNotifications() {
  const { data: session } = useSession()
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<Notification[]>("/api/proxy/notifications"),
    enabled: !!session, // CRÍTICO: no hacer fetch sin sesión activa
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.put<Notification>(`/api/proxy/notifications/${id}/read`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] })
      qc.invalidateQueries({ queryKey: ["notifications", "count"] })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.post<NotificationCount>("/api/proxy/notifications/read-all", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] })
      qc.invalidateQueries({ queryKey: ["notifications", "count"] })
    },
  })
}
