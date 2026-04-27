import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

export interface Settings {
  paperless_url: string | null
  paperless_token: string | null
}

export interface SettingUpdate {
  key: string
  value: string | null
}

export function useSettings() {
  return useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: () => api.get<Settings>("/api/proxy/settings"),
  })
}

export function useUpdateSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: SettingUpdate) => {
      await api.put<void>("/api/proxy/settings", data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] })
    },
  })
}
