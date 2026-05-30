import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { api } from "@/lib/api"

export interface Settings {
  paperless_url: string | null
  paperless_enabled: boolean
  paperless_token_set: boolean
  anthropic_api_key_set: boolean
  language: string | null
  theme: string | null
  mail_host: string | null
  mail_imap_port: string | null
  mail_smtp_port: string | null
  mail_user: string | null
  mail_password_set: boolean
  mail_imap_folder: string | null
  mail_sender_filter: string | null
  mail_smtp_from: string | null
  mail_enabled: boolean
  // OCR provider
  ocr_provider: string
  openai_api_key_set: boolean
  ollama_url: string | null
  ollama_model: string | null
  gemini_api_key_set: boolean
}

export interface SettingUpdate {
  key: string
  value: string | null
}

export function useSettings() {
  const { data: session } = useSession()
  return useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: () => api.get<Settings>("/api/proxy/settings"),
    enabled: !!session,
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

export function useVerifyPaperless() {
  return useMutation({
    mutationFn: () =>
      api.post<{ ok: boolean; error: string | null }>("/api/proxy/settings/verify-paperless", {}),
  })
}

export function useVerifyOcr() {
  return useMutation({
    mutationFn: () =>
      api.post<{ ok: boolean; provider: string; error: string | null }>(
        "/api/proxy/settings/verify-ocr",
        {},
      ),
  })
}
