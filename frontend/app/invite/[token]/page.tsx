"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const PASSWORD_RE =
  /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/

const schema = z
  .object({
    name: z.string().min(1, "El nombre es obligatorio"),
    password: z
      .string()
      .regex(
        PASSWORD_RE,
        "≥12 caracteres, mayúscula, minúscula, número y carácter especial"
      ),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Las contraseñas no coinciden",
  })

type FormValues = z.infer<typeof schema>

interface TokenInfo {
  email: string
  name: string
}

export default function InvitePage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const token = params?.token ?? ""

  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!token) return
    fetch(`/api/proxy/users/invite/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setLoadError(body.detail ?? "Enlace inválido o expirado")
          return
        }
        const data: TokenInfo = await res.json()
        setTokenInfo(data)
        setValue("name", data.name)
      })
      .catch(() => setLoadError("No se pudo validar el enlace"))
      .finally(() => setLoading(false))
  }, [token, setValue])

  const onSubmit = async (data: FormValues) => {
    // 1. Activar la cuenta
    let tokens: { access_token: string; refresh_token: string }
    try {
      const res = await fetch("/api/proxy/users/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: data.password,
          name: data.name,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError("root", { message: body.detail ?? "Error al activar la cuenta" })
        return
      }
      tokens = await res.json()
    } catch {
      setError("root", { message: "Error de conexión. Inténtalo de nuevo." })
      return
    }

    // 2. Crear sesión NextAuth con los tokens devueltos (mismo patrón que login)
    const result = await signIn("credentials", {
      redirect: false,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    })

    if (result?.error) {
      setError("root", { message: "Cuenta activada, pero error al iniciar sesión. Prueba a hacer login." })
      router.push("/login")
      return
    }

    router.push("/")
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center space-y-4 animate-pulse">
          <div className="h-6 w-48 bg-surface-container-high rounded mx-auto" />
          <div className="h-4 w-64 bg-surface-container-high rounded mx-auto" />
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-6">
        <div className="text-center max-w-sm space-y-4">
          <span className="material-symbols-outlined text-5xl text-error">
            link_off
          </span>
          <h1 className="font-headline text-2xl font-bold text-on-surface">
            Enlace inválido
          </h1>
          <p className="font-body text-sm text-on-surface-variant">{loadError}</p>
          <a
            href="/login"
            className="inline-block mt-4 text-sm text-primary hover:underline"
          >
            Ir al inicio de sesión
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Panel izquierdo — branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-primary items-center justify-center p-16 relative overflow-hidden">
        <div className="relative z-10 max-w-sm">
          <div className="w-12 h-12 rounded-xl bg-primary-fixed/20 flex items-center justify-center mb-8">
            <span className="material-symbols-outlined text-primary-fixed text-2xl">
              flight_takeoff
            </span>
          </div>
          <h1 className="font-headline text-5xl font-extrabold tracking-tight text-on-primary leading-none">
            Ledger
          </h1>
          <p className="mt-4 font-body text-primary-fixed/70 text-lg leading-relaxed">
            Has sido invitado/a. Configura tu contraseña para empezar.
          </p>
        </div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-primary-container opacity-40" />
        <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-primary-container opacity-20" />
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Logo móvil */}
          <div className="lg:hidden mb-10 text-center">
            <h1 className="font-headline text-4xl font-extrabold text-primary">Ledger</h1>
          </div>

          <h2 className="font-headline text-2xl font-bold text-on-surface">
            Activar cuenta
          </h2>
          <p className="mt-1 font-body text-sm text-on-surface-variant">
            {tokenInfo?.email}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-10 space-y-7">
            {/* Nombre */}
            <div className="space-y-1.5">
              <label className="font-label text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">
                Nombre
              </label>
              <input
                {...register("name")}
                type="text"
                autoComplete="name"
                placeholder="Tu nombre"
                className="w-full bg-transparent border-b border-outline py-3 text-on-surface
                           placeholder:text-on-surface-variant/40 focus:border-primary
                           focus:outline-none transition-colors font-body text-sm"
              />
              {errors.name && (
                <p className="text-error text-xs font-body">{errors.name.message}</p>
              )}
            </div>

            {/* Contraseña */}
            <div className="space-y-1.5">
              <label className="font-label text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">
                Contraseña
              </label>
              <input
                {...register("password")}
                type="password"
                autoComplete="new-password"
                placeholder="••••••••••••"
                className="w-full bg-transparent border-b border-outline py-3 text-on-surface
                           placeholder:text-on-surface-variant/40 focus:border-primary
                           focus:outline-none transition-colors font-body text-sm"
              />
              {errors.password && (
                <p className="text-error text-xs font-body">{errors.password.message}</p>
              )}
              <p className="text-[11px] text-on-surface-variant/60 font-body">
                ≥12 caracteres · mayúscula · minúscula · número · símbolo
              </p>
            </div>

            {/* Confirmar contraseña */}
            <div className="space-y-1.5">
              <label className="font-label text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">
                Confirmar contraseña
              </label>
              <input
                {...register("confirm")}
                type="password"
                autoComplete="new-password"
                placeholder="••••••••••••"
                className="w-full bg-transparent border-b border-outline py-3 text-on-surface
                           placeholder:text-on-surface-variant/40 focus:border-primary
                           focus:outline-none transition-colors font-body text-sm"
              />
              {errors.confirm && (
                <p className="text-error text-xs font-body">{errors.confirm.message}</p>
              )}
            </div>

            {/* Error raíz */}
            {errors.root && (
              <div className="bg-error-container rounded-xl px-4 py-3">
                <p className="text-error text-sm font-body">{errors.root.message}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full bg-primary text-on-primary py-4 rounded-full
                         font-label font-bold text-sm uppercase tracking-wider
                         hover:bg-primary-container transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed
                         shadow-[0_8px_32px_rgba(0,77,100,0.25)]"
            >
              {isSubmitting ? "Activando cuenta…" : "Activar cuenta"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
