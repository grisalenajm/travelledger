"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useTheme } from "next-themes"
import { api } from "@/lib/api"
import type { User } from "@/types"
import { Button } from "@/components/ui/button"
import { useSettings, useUpdateSetting, useVerifyPaperless } from "@/hooks/use-settings"

const CURRENCIES = [
  "EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "SEK", "NOK", "DKK",
  "ARS", "BRL", "MXN", "CLP", "COP", "PEN",
  "CNY", "HKD", "SGD", "KRW", "THB", "INR",
  "AED", "TRY", "PLN", "CZK", "HUF", "RON",
]

const labelClass =
  "font-label text-[10px] font-bold tracking-widest uppercase text-on-surface-variant"
const inputClass =
  "w-full bg-transparent border-b border-outline py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none transition-colors font-body text-sm"
const selectClass =
  "w-full bg-transparent border-b border-outline py-3 text-on-surface focus:border-primary focus:outline-none transition-colors font-body text-sm appearance-none cursor-pointer"
const errorClass = "text-error text-xs font-body mt-1"

// ─── Sección "Cuenta" ────────────────────────────────────────────────────────

const accountSchema = z
  .object({
    name: z.string().min(1, "El nombre es obligatorio"),
    email: z.string().email("Email inválido"),
    currency_base: z.string().min(1, "Selecciona una moneda"),
    password_current: z.string().optional(),
    password_new: z.string().optional(),
    password_confirm: z.string().optional(),
  })
  .refine(
    (d) => !d.password_new || d.password_new === d.password_confirm,
    { message: "Las contraseñas no coinciden", path: ["password_confirm"] },
  )
  .refine(
    (d) => !d.password_new || !!d.password_current,
    { message: "Introduce tu contraseña actual", path: ["password_current"] },
  )

type AccountForm = z.infer<typeof accountSchema>

function AccountSection({ user }: { user: User }) {
  const [saved, setSaved] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const qc = useQueryClient()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    values: {
      name: user.name,
      email: user.email,
      currency_base: user.currency_base,
      password_current: "",
      password_new: "",
      password_confirm: "",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: AccountForm) => {
      const payload: Record<string, string> = {
        name: data.name,
        email: data.email,
        currency_base: data.currency_base,
      }
      if (data.password_current && data.password_new) {
        payload.password_current = data.password_current
        payload.password_new = data.password_new
      }
      return api.put<User>("/api/proxy/users/me", payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
    onError: () => setError("root", { message: "Error al guardar. Inténtalo de nuevo." }),
  })

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-headline text-lg font-bold text-on-surface">Cuenta</h2>
        <p className="text-sm text-on-surface-variant mt-0.5">Información básica de tu perfil</p>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
        <div className="space-y-1.5">
          <label className={labelClass}>Nombre</label>
          <input {...register("name")} placeholder="Tu nombre" className={inputClass} />
          {errors.name && <p className={errorClass}>{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>Email</label>
          <input {...register("email")} type="email" placeholder="tu@ejemplo.com" className={inputClass} />
          {errors.email && <p className={errorClass}>{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>Moneda base (reporting)</label>
          <select {...register("currency_base")} className={selectClass}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {errors.currency_base && <p className={errorClass}>{errors.currency_base.message}</p>}
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="flex items-center gap-2 text-sm text-primary font-body hover:underline"
          >
            <span className="material-symbols-outlined text-base">
              {showPassword ? "expand_less" : "expand_more"}
            </span>
            Cambiar contraseña
          </button>

          {showPassword && (
            <div className="space-y-5 pl-4 border-l-2 border-outline-variant">
              <div className="space-y-1.5">
                <label className={labelClass}>Contraseña actual</label>
                <input
                  {...register("password_current")}
                  type="password"
                  placeholder="••••••••"
                  className={inputClass}
                />
                {errors.password_current && (
                  <p className={errorClass}>{errors.password_current.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Nueva contraseña</label>
                <input
                  {...register("password_new")}
                  type="password"
                  placeholder="Mín. 8 caracteres"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Confirmar nueva contraseña</label>
                <input
                  {...register("password_confirm")}
                  type="password"
                  placeholder="Repite la nueva contraseña"
                  className={inputClass}
                />
                {errors.password_confirm && (
                  <p className={errorClass}>{errors.password_confirm.message}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {errors.root && (
          <div className="bg-error-container rounded-xl px-4 py-3">
            <p className="text-error text-sm font-body">{errors.root.message}</p>
          </div>
        )}

        <div className="flex items-center gap-4 pt-2">
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {mutation.isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-base">check_circle</span>
              Cambios guardados
            </span>
          )}
        </div>
      </form>
    </section>
  )
}

// ─── Sección "OCR" ───────────────────────────────────────────────────────────

function OcrSection({ keySet }: { keySet: boolean }) {
  const [editing, setEditing] = useState(!keySet)
  const [value, setValue] = useState("")
  const [saved, setSaved] = useState(false)
  const updateSetting = useUpdateSetting()

  const handleSave = async () => {
    if (!value.trim()) return
    await updateSetting.mutateAsync({ key: "anthropic_api_key", value: value.trim() })
    setValue("")
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-headline text-lg font-bold text-on-surface">OCR</h2>
        <p className="text-sm text-on-surface-variant mt-0.5">
          Integración con Anthropic para lectura automática de facturas
        </p>
      </div>

      <div className="space-y-3">
        <label className={labelClass}>Clave API de Anthropic</label>

        {keySet && !editing ? (
          <div className="flex items-center justify-between py-3 border-b border-outline">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-primary">check_circle</span>
              <span className="text-sm font-body text-on-surface-variant">Configurada</span>
              <span className="font-mono text-sm text-on-surface-variant/40">•••••••••••••••••••</span>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="text-sm text-primary hover:underline font-body"
            >
              Cambiar
            </button>
          </div>
        ) : (
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="sk-ant-..."
            className={inputClass}
          />
        )}

        <p className="text-on-surface-variant/60 text-[11px] font-body">
          Si no configuras tu propia clave, se usará la del servidor.
        </p>

        {editing && (
          <div className="flex items-center gap-3 pt-1">
            <Button
              type="button"
              onClick={handleSave}
              disabled={updateSetting.isPending || !value.trim()}
            >
              {updateSetting.isPending ? "Guardando…" : "Guardar"}
            </Button>
            {keySet && (
              <button
                type="button"
                onClick={() => { setEditing(false); setValue("") }}
                className="text-sm text-on-surface-variant hover:underline font-body"
              >
                Cancelar
              </button>
            )}
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-base">check_circle</span>
                Guardado
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Sección "Paperless" ─────────────────────────────────────────────────────

interface PaperlessSectionProps {
  paperlessUrl: string | null
  paperlessEnabled: boolean
  tokenSet: boolean
}

function PaperlessSection({ paperlessUrl, paperlessEnabled, tokenSet }: PaperlessSectionProps) {
  const [url, setUrl] = useState(paperlessUrl ?? "")
  const [token, setToken] = useState("")
  const [tokenEditing, setTokenEditing] = useState(!tokenSet)
  const [enabled, setEnabled] = useState(paperlessEnabled)
  const [saved, setSaved] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; message: string } | null>(null)
  const updateSetting = useUpdateSetting()
  const verifyPaperless = useVerifyPaperless()

  const handleSave = async () => {
    await updateSetting.mutateAsync({ key: "paperless_enabled", value: enabled ? "true" : "false" })
    await updateSetting.mutateAsync({ key: "paperless_url", value: url || null })
    if (tokenEditing && token.trim()) {
      await updateSetting.mutateAsync({ key: "paperless_token", value: token.trim() })
      setToken("")
      setTokenEditing(false)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleVerify = async () => {
    setVerifyResult(null)
    try {
      const res = await verifyPaperless.mutateAsync()
      setVerifyResult({
        ok: res.ok,
        message: res.ok ? "Conexión verificada correctamente" : (res.error ?? "Error desconocido"),
      })
    } catch {
      setVerifyResult({ ok: false, message: "No se pudo conectar con Paperless" })
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-headline text-lg font-bold text-on-surface">Paperless-ngx</h2>
        <p className="text-sm text-on-surface-variant mt-0.5">
          Almacenamiento de facturas en tu instancia Paperless
        </p>
      </div>

      <div className="space-y-5">
        {/* Toggle */}
        <div className="flex items-center justify-between py-2">
          <div>
            <span className="font-body text-sm text-on-surface">Activar Paperless</span>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Si está desactivado, las imágenes se guardan en volumen local
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => {
              const newValue = !enabled
              setEnabled(newValue)
              updateSetting.mutate({ key: "paperless_enabled", value: newValue ? "true" : "false" })
            }}
            className={`w-12 h-6 rounded-full transition-colors ${
              enabled ? "bg-primary" : "bg-outline"
            } relative flex-shrink-0`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* URL */}
        <div className="space-y-1.5">
          <label className={labelClass}>URL de Paperless</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://paperless.tudominio.com"
            className={inputClass}
          />
        </div>

        {/* Token */}
        <div className="space-y-1.5">
          <label className={labelClass}>Token API</label>
          {tokenSet && !tokenEditing ? (
            <div className="flex items-center justify-between py-3 border-b border-outline">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-primary">check_circle</span>
                <span className="font-mono text-sm text-on-surface-variant/40">•••••••••••••••••••</span>
              </div>
              <button
                onClick={() => setTokenEditing(true)}
                className="text-sm text-primary hover:underline font-body"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Token de la API de Paperless"
                className={inputClass}
              />
              {tokenSet && (
                <button
                  type="button"
                  onClick={() => { setTokenEditing(false); setToken("") }}
                  className="text-sm text-on-surface-variant hover:underline font-body whitespace-nowrap"
                >
                  Cancelar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button type="button" onClick={handleSave} disabled={updateSetting.isPending}>
            {updateSetting.isPending ? "Guardando…" : "Guardar"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleVerify}
            disabled={verifyPaperless.isPending}
          >
            {verifyPaperless.isPending ? "Verificando…" : "Verificar conexión"}
          </Button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-base">check_circle</span>
              Guardado
            </span>
          )}
        </div>

        {verifyResult && (
          <div
            className={`rounded-xl px-4 py-3 text-sm font-body flex items-center gap-2 ${
              verifyResult.ok
                ? "bg-surface-container text-on-surface"
                : "bg-error-container text-error"
            }`}
          >
            <span className="material-symbols-outlined text-base">
              {verifyResult.ok ? "check_circle" : "error"}
            </span>
            {verifyResult.message}
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Sección "Apariencia" ────────────────────────────────────────────────────

function AppearanceSection({ currentLanguage }: { currentLanguage: string | null }) {
  const { theme, setTheme } = useTheme()
  const [lang, setLang] = useState(currentLanguage ?? "es")

  const handleLanguageChange = (newLang: string) => {
    setLang(newLang)
    document.cookie = `NEXT_LOCALE=${newLang};path=/;max-age=31536000`
    window.location.reload()
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-headline text-lg font-bold text-on-surface">Apariencia</h2>
        <p className="text-sm text-on-surface-variant mt-0.5">Idioma y tema visual</p>
      </div>

      <div className="space-y-6">
        {/* Idioma */}
        <div className="space-y-3">
          <label className={labelClass}>Idioma</label>
          <div className="flex gap-3">
            {[
              { value: "es", label: "Español" },
              { value: "en", label: "English" },
            ].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleLanguageChange(value)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-body transition-colors ${
                  lang === value
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-outline text-on-surface-variant hover:border-primary/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-on-surface-variant/60 text-[11px] font-body">
            El cambio de idioma recarga la página.
          </p>
        </div>

        {/* Tema */}
        <div className="space-y-3">
          <label className={labelClass}>Tema</label>
          <div className="flex gap-3">
            {[
              { value: "system", label: "Sistema", icon: "brightness_auto" },
              { value: "light", label: "Claro", icon: "light_mode" },
              { value: "dark", label: "Oscuro", icon: "dark_mode" },
            ].map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm font-body transition-colors ${
                  theme === value
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-outline text-on-surface-variant hover:border-primary/50"
                }`}
              >
                <span className="material-symbols-outlined text-base">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["me"],
    queryFn: () => api.get<User>("/api/proxy/users/me"),
  })

  const { data: settings, isLoading: settingsLoading } = useSettings()

  if (userLoading || settingsLoading || !user || !settings) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-4 py-8 animate-pulse space-y-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-5 bg-surface-container-high rounded w-40" />
              <div className="h-10 bg-surface-container-high rounded" />
              <div className="h-10 bg-surface-container-high rounded" />
            </div>
          ))}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-10">
        <div>
          <h1 className="font-headline text-2xl font-bold text-on-surface">Perfil</h1>
          <p className="mt-1 text-sm text-on-surface-variant">{user.email}</p>
        </div>

        <AccountSection user={user} />

        <hr className="border-outline-variant" />

        <OcrSection keySet={settings.anthropic_api_key_set} />

        <hr className="border-outline-variant" />

        <PaperlessSection
          paperlessUrl={settings.paperless_url}
          paperlessEnabled={settings.paperless_enabled}
          tokenSet={settings.paperless_token_set}
        />

        <hr className="border-outline-variant" />

        <AppearanceSection currentLanguage={settings.language} />

        <div className="pb-8" />
      </div>
    </main>
  )
}
