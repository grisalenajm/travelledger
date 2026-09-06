"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useIsGuest } from "@/hooks/use-is-guest"
import { useIsAdmin } from "@/hooks/use-role"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { api } from "@/lib/api"
import type { User } from "@/types"
import type { Settings } from "@/hooks/use-settings"
import { Button } from "@/components/ui/button"
import { useCurrencies } from "@/hooks/use-currencies"

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

const imapSchema = z.object({
  mail_host: z.string(),
  mail_imap_port: z.string(),
  mail_user: z.string(),
  mail_password: z.string(),
  mail_imap_folder: z.string(),
  mail_sender_filter: z.string(),
  mail_smtp_port: z.string(),
  mail_smtp_from: z.string(),
})

type ProfileValues = z.infer<typeof profileSchema>
type PaperlessValues = z.infer<typeof paperlessSchema>
type ImapValues = z.infer<typeof imapSchema>

interface VerifyResult {
  ok: boolean
  error: string | null
}

export default function SettingsPage() {
  const isGuest = useIsGuest()
  const isAdmin = useIsAdmin()
  const router = useRouter()
  useEffect(() => {
    if (isGuest) router.replace("/")
  }, [isGuest, router])

  const [profileSaved, setProfileSaved] = useState(false)
  const [paperlessSaved, setPaperlessSaved] = useState(false)
  const [imapSaved, setImapSaved] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [showImapPassword, setShowImapPassword] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "loading" | "ok" | "error">("idle")
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [imapTestStatus, setImapTestStatus] = useState<"idle" | "loading" | "ok" | "error">("idle")
  const [imapTestError, setImapTestError] = useState<string | null>(null)
  const [pollStatus, setPollStatus] = useState<"idle" | "loading" | "done">("idle")
  const [pollResult, setPollResult] = useState<string | null>(null)
  const [imapEnabled, setImapEnabled] = useState(false)
  const [smtpTestStatus, setSmtpTestStatus] = useState<"idle" | "loading" | "ok" | "error">("idle")
  const [smtpTestError, setSmtpTestError] = useState<string | null>(null)

  const queryClient = useQueryClient()

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["me"],
    queryFn: () => api.get<User>("/api/proxy/users/me"),
  })

  const { data: settings, isLoading: settingsLoading } = useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: () => api.get<Settings>("/api/proxy/settings"),
  })

  useEffect(() => {
    if (settings) setImapEnabled(settings.mail_enabled ?? false)
  }, [settings])

  const { data: currencies } = useCurrencies()

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    setError: setProfileError,
    watch: watchProfile,
    formState: { errors: profileErrors, isSubmitting: profileSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: user ? { name: user.name, currency_base: user.currency_base } : undefined,
  })

  const hasExistingToken = settings?.paperless_token_set ?? false
  const hasExistingImapPassword = settings?.mail_password_set ?? false

  const {
    register: registerPaperless,
    handleSubmit: handlePaperlessSubmit,
    setError: setPaperlessError,
    formState: { errors: paperlessErrors, isSubmitting: paperlessSubmitting },
  } = useForm<PaperlessValues>({
    resolver: zodResolver(paperlessSchema),
    values: settings
      ? { paperless_url: settings.paperless_url ?? "", paperless_token: "" }
      : undefined,
  })

  const {
    register: registerImap,
    handleSubmit: handleImapSubmit,
    setError: setImapError,
    formState: { errors: imapErrors, isSubmitting: imapSubmitting },
  } = useForm<ImapValues>({
    resolver: zodResolver(imapSchema),
    values: settings
      ? {
          mail_host: settings.mail_host ?? "",
          mail_imap_port: settings.mail_imap_port ?? "993",
          mail_user: settings.mail_user ?? "",
          mail_password: "",
          mail_imap_folder: settings.mail_imap_folder ?? "INBOX",
          mail_sender_filter: settings.mail_sender_filter ?? "",
          mail_smtp_port: settings.mail_smtp_port ?? "587",
          mail_smtp_from: settings.mail_smtp_from ?? "",
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
      await api.put("/api/proxy/settings", { key: "paperless_url", value: data.paperless_url || null })
      if (data.paperless_token || !hasExistingToken) {
        await api.put("/api/proxy/settings", { key: "paperless_token", value: data.paperless_token || null })
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

  const imapMutation = useMutation({
    mutationFn: async (data: ImapValues) => {
      const pairs: Array<[string, string | null]> = [
        ["mail_host", data.mail_host || null],
        ["mail_imap_port", data.mail_imap_port || null],
        ["mail_user", data.mail_user || null],
        ["mail_imap_folder", data.mail_imap_folder || null],
        ["mail_sender_filter", data.mail_sender_filter || null],
        ["mail_enabled", imapEnabled ? "true" : "false"],
        ["mail_smtp_port", data.mail_smtp_port || null],
        ["mail_smtp_from", data.mail_smtp_from || null],
      ]
      for (const [key, value] of pairs) {
        await api.put("/api/proxy/settings", { key, value })
      }
      if (data.mail_password || !hasExistingImapPassword) {
        await api.put("/api/proxy/settings", { key: "mail_password", value: data.mail_password || null })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] })
      setImapSaved(true)
      setImapTestStatus("idle")
      setTimeout(() => setImapSaved(false), 3000)
    },
    onError: () => {
      setImapError("root", { message: "Error al guardar. Inténtalo de nuevo." })
    },
  })

  async function verifyConnection() {
    setVerifyStatus("loading")
    setVerifyError(null)
    try {
      const result = await api.post<VerifyResult>("/api/proxy/settings/verify-paperless", {})
      setVerifyStatus(result.ok ? "ok" : "error")
      if (!result.ok) setVerifyError(result.error)
    } catch {
      setVerifyStatus("error")
      setVerifyError("No se pudo conectar con Paperless")
    }
  }

  async function testImapConnection() {
    setImapTestStatus("loading")
    setImapTestError(null)
    try {
      const result = await api.post<VerifyResult>("/api/proxy/email/test-connection", {})
      setImapTestStatus(result.ok ? "ok" : "error")
      if (!result.ok) setImapTestError(result.error)
    } catch {
      setImapTestStatus("error")
      setImapTestError("No se pudo conectar con el servidor IMAP")
    }
  }

  async function handleTestSmtp() {
    setSmtpTestStatus("loading")
    setSmtpTestError(null)
    try {
      const result = await api.post<VerifyResult>("/api/proxy/settings/test-smtp", {})
      setSmtpTestStatus(result.ok ? "ok" : "error")
      if (!result.ok) setSmtpTestError(result.error)
    } catch {
      setSmtpTestStatus("error")
      setSmtpTestError("No se pudo enviar el email de prueba")
    }
  }

  async function pollNow() {
    setPollStatus("loading")
    setPollResult(null)
    try {
      const result = await api.post<{ processed: number; legs_created: number; error?: string }>(
        "/api/proxy/email/poll-now", {}
      )
      setPollStatus("done")
      setPollResult(`${result.processed} emails, ${result.legs_created} tramos creados`)
    } catch {
      setPollStatus("done")
      setPollResult("Error al procesar emails")
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

          <Link
            href="/settings/profile"
            className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-container-lowest shadow-editorial hover:bg-surface-container transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-on-surface-variant">person</span>
              <div>
                <p className="text-sm font-medium text-on-surface">Perfil completo</p>
                <p className="text-xs text-on-surface-variant">Nombre, email, moneda, idioma, tema</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
          </Link>

          <form
            onSubmit={handleProfileSubmit((data) => profileMutation.mutate(data))}
            className="space-y-7"
          >
            <div className="space-y-1.5">
              <label className={labelClass}>Nombre</label>
              <input {...registerProfile("name")} placeholder="Tu nombre" className={inputClass} />
              {profileErrors.name && <p className={errorClass}>{profileErrors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className={labelClass}>Moneda base</label>
              <select
                {...registerProfile("currency_base")}
                value={watchProfile("currency_base") ?? ""}
                className={selectClass}
              >
                {(currencies ?? []).map((c) => (
                  <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
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
              <Button type="submit" disabled={profileSubmitting || profileMutation.isPending}>
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

        {/* ── Sección 2: Métodos de pago ── */}
        <section className="space-y-4">
          <div>
            <h2 className="font-headline text-xl font-bold text-on-surface">Métodos de pago</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Crea y gestiona tus métodos de pago personalizados.
            </p>
          </div>
          <Link
            href="/settings/payment-methods"
            className="flex items-center justify-between rounded-xl bg-surface-container-lowest px-4 py-3 shadow-editorial hover:bg-surface-container transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-[20px] leading-none">payment</span>
              <span className="text-sm font-medium text-on-surface">Gestionar métodos de pago</span>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant text-[18px] leading-none">chevron_right</span>
          </Link>
          <Link
            href="/settings/cards"
            className="flex items-center justify-between rounded-xl bg-surface-container-lowest px-4 py-3 shadow-editorial hover:bg-surface-container transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-[20px] leading-none">credit_card</span>
              <span className="text-sm font-medium text-on-surface">Tarjetas de fidelización</span>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant text-[18px] leading-none">chevron_right</span>
          </Link>
        </section>

        <div className="border-t border-outline-variant" />

        {/* ── Sección 2b: Gestión de usuarios (solo admin) ── */}
        {isAdmin && (
          <>
            <section className="space-y-4">
              <div>
                <h2 className="font-headline text-xl font-bold text-on-surface">Administración</h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Gestiona los usuarios de esta instancia.
                </p>
              </div>
              <Link
                href="/settings/users"
                className="flex items-center justify-between rounded-xl bg-surface-container-lowest px-4 py-3 shadow-editorial hover:bg-surface-container transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-[20px] leading-none">group</span>
                  <span className="text-sm font-medium text-on-surface">Gestionar usuarios</span>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant text-[18px] leading-none">chevron_right</span>
              </Link>
            </section>

            <div className="border-t border-outline-variant" />
          </>
        )}

        {/* ── Sección 3: Paperless-ngx ── */}
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
                placeholder="http://paperless.yourdomain.com:8000"
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
              <Button type="submit" disabled={paperlessSubmitting || paperlessMutation.isPending}>
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

        <div className="border-t border-outline-variant" />

        {/* ── Sección 4: Integración email IMAP ── */}
        <section className="space-y-6">
          <div>
            <h2 className="font-headline text-xl font-bold text-on-surface">Integración email</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Importación automática de emails de viaje vía IMAP. Reenvía las confirmaciones
              (vuelos, hoteles, trenes, coches) al buzón configurado y Ledger creará los tramos
              automáticamente.
            </p>
          </div>

          <form
            onSubmit={handleImapSubmit((data) => imapMutation.mutate(data))}
            className="space-y-7"
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={imapEnabled}
                onClick={() => setImapEnabled((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${imapEnabled ? "bg-primary" : "bg-outline"}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${imapEnabled ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
              <label className={labelClass}>Importación automática activada</label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className={labelClass}>Servidor IMAP</label>
                <input
                  {...registerImap("mail_host")}
                  placeholder="imap.yourdomain.com"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Puerto</label>
                <input
                  {...registerImap("mail_imap_port")}
                  placeholder="993"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={labelClass}>Usuario (email)</label>
              <input
                {...registerImap("mail_user")}
                placeholder="travel@yourdomain.com"
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className={labelClass}>Contraseña</label>
              <div className="relative">
                <input
                  {...registerImap("mail_password")}
                  type={showImapPassword ? "text" : "password"}
                  placeholder={
                    hasExistingImapPassword
                      ? "Contraseña configurada — escribe para cambiar"
                      : "Contraseña del buzón IMAP"
                  }
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowImapPassword((v) => !v)}
                  className="absolute right-0 bottom-3 text-on-surface-variant hover:text-on-surface transition-colors"
                  aria-label={showImapPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  <span className="material-symbols-outlined text-base">
                    {showImapPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelClass}>Carpeta</label>
                <input
                  {...registerImap("mail_imap_folder")}
                  placeholder="INBOX"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Filtro remitente</label>
                <input
                  {...registerImap("mail_sender_filter")}
                  placeholder="@yourcompany.com (vacío = aceptar todos)"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className={labelClass}>Puerto SMTP</label>
                <input
                  {...registerImap("mail_smtp_port")}
                  placeholder="587"
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <label className={labelClass}>Remitente</label>
                <input
                  {...registerImap("mail_smtp_from")}
                  placeholder="Ledger <correo@ejemplo.com>"
                  className={inputClass}
                />
              </div>
            </div>

            {imapErrors.root && (
              <div className="bg-error-container rounded-xl px-4 py-3">
                <p className="text-error text-sm font-body">{imapErrors.root.message}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button type="submit" disabled={imapSubmitting || imapMutation.isPending}>
                {imapMutation.isPending ? "Guardando…" : "Guardar"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={testImapConnection}
                disabled={imapTestStatus === "loading"}
              >
                {imapTestStatus === "loading" ? "Probando…" : "Probar conexión"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={pollNow}
                disabled={pollStatus === "loading"}
              >
                {pollStatus === "loading" ? "Procesando…" : "Procesar ahora"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleTestSmtp}
                disabled={smtpTestStatus === "loading"}
              >
                {smtpTestStatus === "loading" ? "Enviando…" : "Enviar email de prueba"}
              </Button>

              {imapSaved && (
                <span className="flex items-center gap-1.5 text-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  Cambios guardados
                </span>
              )}
              {imapTestStatus === "ok" && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  Conectado
                </span>
              )}
              {imapTestStatus === "error" && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-error">
                  <span className="material-symbols-outlined text-base">error</span>
                  {imapTestError ?? "Error de conexión"}
                </span>
              )}
              {pollStatus === "done" && pollResult && (
                <span className="flex items-center gap-1.5 text-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-base">inbox</span>
                  {pollResult}
                </span>
              )}
              {smtpTestStatus === "ok" && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  Email enviado
                </span>
              )}
              {smtpTestStatus === "error" && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-error">
                  <span className="material-symbols-outlined text-base">error</span>
                  {smtpTestError ?? "Error al enviar"}
                </span>
              )}
            </div>
          </form>
        </section>

      </div>
    </main>
  )
}
