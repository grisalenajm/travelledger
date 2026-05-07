"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { api } from "@/lib/api"
import type { User } from "@/types"
import type { Settings } from "@/hooks/use-settings"
import { Button } from "@/components/ui/button"

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "JPY", "ARS", "BRL", "MXN", "CAD", "AUD"]

const labelClass =
  "font-label text-[10px] font-bold tracking-widest uppercase text-on-surface-variant"
const inputClass =
  "w-full bg-transparent border-b border-outline py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none transition-colors font-body text-sm"
const selectClass =
  "w-full bg-transparent border-b border-outline py-3 text-on-surface focus:border-primary focus:outline-none transition-colors font-body text-sm appearance-none cursor-pointer"
const errorClass = "text-error text-xs font-body mt-1"

const profileSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  currency_base: z.string().min(1, "Selecciona una moneda"),
})

const paperlessSchema = z.object({
  paperless_url: z.string(),
  paperless_token: z.string(),
})

type ProfileValues = z.infer<typeof profileSchema>
type PaperlessValues = z.infer<typeof paperlessSchema>

interface VerifyResult {
  ok: boolean
  error: string | null
}

export default function SettingsPage() {
  const [profileSaved, setProfileSaved] = useState(false)
  const [paperlessSaved, setPaperlessSaved] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "loading" | "ok" | "error">("idle")
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const queryClient = useQueryClient()

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["me"],
    queryFn: () => api.get<User>("/api/proxy/users/me"),
  })

  const { data: settings, isLoading: settingsLoading } = useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: () => api.get<Settings>("/api/proxy/settings"),
  })

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    setError: setProfileError,
    formState: { errors: profileErrors, isSubmitting: profileSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: user ? { name: user.name, currency_base: user.currency_base } : undefined,
  })

  const hasExistingToken = settings?.paperless_token === "***"

  const {
    register: registerPaperless,
    handleSubmit: handlePaperlessSubmit,
    setError: setPaperlessError,
    formState: { errors: paperlessErrors, isSubmitting: paperlessSubmitting },
  } = useForm<PaperlessValues>({
    resolver: zodResolver(paperlessSchema),
    values: settings
      ? {
          paperless_url: settings.paperless_url ?? "",
          paperless_token: "",  // always blank — placeholder indicates if one is configured
        }
      : undefined,
  })

  const profileMutation = useMutation({
    mutationFn: (data: ProfileValues) => api.put<User>("/api/proxy/users/me", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] })
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 3000)
    },
    onError: () => {
      setProfileError("root", { message: "Error al guardar. Inténtalo de nuevo." })
    },
  })

  const paperlessMutation = useMutation({
    mutationFn: async (data: PaperlessValues) => {
      await api.put("/api/proxy/settings", {
        key: "paperless_url",
        value: data.paperless_url || null,
      })
      // Skip token update if field is empty and a token is already configured
      if (data.paperless_token || !hasExistingToken) {
        await api.put("/api/proxy/settings", {
          key: "paperless_token",
          value: data.paperless_token || null,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] })
      setPaperlessSaved(true)
      setVerifyStatus("idle")
      setTimeout(() => setPaperlessSaved(false), 3000)
    },
    onError: () => {
      setPaperlessError("root", { message: "Error al guardar. Inténtalo de nuevo." })
    },
  })

  async function verifyConnection() {
    setVerifyStatus("loading")
    setVerifyError(null)
    try {
      const result = await api.post<VerifyResult>("/api/proxy/settings/verify-paperless", {})
      if (result.ok) {
        setVerifyStatus("ok")
      } else {
        setVerifyStatus("error")
        setVerifyError(result.error)
      }
    } catch {
      setVerifyStatus("error")
      setVerifyError("No se pudo conectar con Paperless")
    }
  }

  if (userLoading || settingsLoading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-lg px-4 py-8 animate-pulse space-y-6">
          <div className="h-7 bg-surface-container-high rounded w-32" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-surface-container-high rounded" />
          ))}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-8 space-y-12">

        {/* ── Sección 1: Perfil ── */}
        <section className="space-y-6">
          <div>
            <h1 className="font-headline text-2xl font-bold text-on-surface">Perfil</h1>
            <p className="mt-1 text-sm text-on-surface-variant">{user?.email}</p>
          </div>

          <form
            onSubmit={handleProfileSubmit((data) => profileMutation.mutate(data))}
            className="space-y-7"
          >
            <div className="space-y-1.5">
              <label className={labelClass}>Nombre</label>
              <input
                {...registerProfile("name")}
                placeholder="Tu nombre"
                className={inputClass}
              />
              {profileErrors.name && (
                <p className={errorClass}>{profileErrors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className={labelClass}>Moneda base</label>
              <select {...registerProfile("currency_base")} className={selectClass}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {profileErrors.currency_base && (
                <p className={errorClass}>{profileErrors.currency_base.message}</p>
              )}
            </div>

            {profileErrors.root && (
              <div className="bg-error-container rounded-xl px-4 py-3">
                <p className="text-error text-sm font-body">{profileErrors.root.message}</p>
              </div>
            )}

            <div className="flex items-center gap-4 pt-2">
              <Button
                type="submit"
                disabled={profileSubmitting || profileMutation.isPending}
              >
                {profileMutation.isPending ? "Guardando…" : "Guardar cambios"}
              </Button>
              {profileSaved && (
                <span className="flex items-center gap-1.5 text-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  Cambios guardados
                </span>
              )}
            </div>
          </form>
        </section>

        <div className="border-t border-outline-variant" />

        {/* ── Sección 2: Integraciones → Paperless ── */}
        <section className="space-y-6">
          <div>
            <h2 className="font-headline text-xl font-bold text-on-surface">Integraciones</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Paperless-ngx</p>
          </div>

          <form
            onSubmit={handlePaperlessSubmit((data) => paperlessMutation.mutate(data))}
            className="space-y-7"
          >
            <div className="space-y-1.5">
              <label className={labelClass}>Paperless URL</label>
              <input
                {...registerPaperless("paperless_url")}
                placeholder="http://192.168.1.154:8000"
                className={inputClass}
              />
              {paperlessErrors.paperless_url && (
                <p className={errorClass}>{paperlessErrors.paperless_url.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className={labelClass}>Token</label>
              <div className="relative">
                <input
                  {...registerPaperless("paperless_token")}
                  type={showToken ? "text" : "password"}
                  placeholder={
                    hasExistingToken
                      ? "Token configurado — escribe para cambiar"
                      : "Token de API de Paperless"
                  }
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-0 bottom-3 text-on-surface-variant hover:text-on-surface transition-colors"
                  aria-label={showToken ? "Ocultar token" : "Mostrar token"}
                >
                  <span className="material-symbols-outlined text-base">
                    {showToken ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
              {paperlessErrors.paperless_token && (
                <p className={errorClass}>{paperlessErrors.paperless_token.message}</p>
              )}
            </div>

            {paperlessErrors.root && (
              <div className="bg-error-container rounded-xl px-4 py-3">
                <p className="text-error text-sm font-body">{paperlessErrors.root.message}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                type="submit"
                disabled={paperlessSubmitting || paperlessMutation.isPending}
              >
                {paperlessMutation.isPending ? "Guardando…" : "Guardar"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={verifyConnection}
                disabled={verifyStatus === "loading"}
              >
                {verifyStatus === "loading" ? "Verificando…" : "Verificar conexión"}
              </Button>

              {paperlessSaved && (
                <span className="flex items-center gap-1.5 text-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  Cambios guardados
                </span>
              )}

              {verifyStatus === "ok" && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  Conectado
                </span>
              )}

              {verifyStatus === "error" && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-error">
                  <span className="material-symbols-outlined text-base">error</span>
                  {verifyError ?? "Error de conexión"}
                </span>
              )}
            </div>
          </form>
        </section>

      </div>
    </main>
  )
}
