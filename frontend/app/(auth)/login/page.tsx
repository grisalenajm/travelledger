"use client"

import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useEffect, useState } from "react"
import { useI18n } from "@/lib/i18n"
import { LanguageSelector } from "@/components/language-selector"

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Contraseña requerida"),
})

type LoginForm = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [showSetup, setShowSetup] = useState(false)

  useEffect(() => {
    fetch("/api/proxy/auth/status")
      .then((r) => r.json())
      .then((d) => { if (!d.has_users) setShowSetup(true) })
      .catch(() => {})
  }, [])

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: LoginForm) => {
    // 1. Call the backend through the proxy so the browser receives the HttpOnly
    //    refresh_token cookie (persistent, 7-day). If we went directly through
    //    NextAuth signIn(), the Set-Cookie would be lost in the server-to-server call.
    let tokens: { access_token: string; refresh_token: string }
    try {
      const proxyRes = await fetch("/api/proxy/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      })
      if (!proxyRes.ok) {
        setError("root", { message: "Email o contraseña incorrectos" })
        return
      }
      tokens = await proxyRes.json()
    } catch {
      setError("root", { message: "Error de conexión. Inténtalo de nuevo." })
      return
    }

    // 2. Create the NextAuth session using the pre-fetched tokens.
    //    authorize() in lib/auth.ts detects accessToken+refreshToken and skips
    //    a second backend call — it only verifies the token with /api/users/me.
    const result = await signIn("credentials", {
      redirect: false,
      email: data.email,
      password: data.password,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    })

    if (result?.error) {
      setError("root", { message: "Email o contraseña incorrectos" })
      return
    }

    router.push("/")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-surface flex relative">
      {/* Language selector */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageSelector />
      </div>

      {/* Left panel — brand */}
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
            Cada viaje, cada gasto — registrado con precisión.
          </p>
          <div className="mt-16 space-y-4">
            {["Gastos en cualquier moneda", "Escaneo de tickets con OCR", "Exportación para reembolso"].map(
              (feat) => (
                <div key={feat} className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary-fixed text-base">
                    check_circle
                  </span>
                  <span className="font-body text-sm text-primary-fixed/80">{feat}</span>
                </div>
              )
            )}
          </div>
        </div>
        {/* Decorative circles */}
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-primary-container opacity-40" />
        <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-primary-container opacity-20" />
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10 text-center">
            <h1 className="font-headline text-4xl font-extrabold text-primary">Ledger</h1>
          </div>

          <h2 className="font-headline text-2xl font-bold text-on-surface">
            {t("auth.welcome")}
          </h2>
          <p className="mt-1 font-body text-sm text-on-surface-variant">
            {t("auth.sign_in_subtitle")}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-10 space-y-7">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="font-label text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">
                Email
              </label>
              <input
                {...register("email")}
                type="email"
                autoComplete="email"
                placeholder="tu@ejemplo.com"
                className="w-full bg-transparent border-b border-outline py-3 text-on-surface
                           placeholder:text-on-surface-variant/40 focus:border-primary
                           focus:outline-none transition-colors font-body text-sm"
              />
              {errors.email && (
                <p className="text-error text-xs font-body">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="font-label text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">
                {t("auth.password")}
              </label>
              <input
                {...register("password")}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-transparent border-b border-outline py-3 text-on-surface
                           placeholder:text-on-surface-variant/40 focus:border-primary
                           focus:outline-none transition-colors font-body text-sm"
              />
              {errors.password && (
                <p className="text-error text-xs font-body">{errors.password.message}</p>
              )}
            </div>

            {/* Root error */}
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
              {isSubmitting ? t("common.loading") : t("auth.login")}
            </button>

            {showSetup && (
              <p className="text-center text-sm text-on-surface-variant font-body">
                ¿Primera vez?{" "}
                <a href="/setup" className="text-primary hover:underline font-medium">
                  Configura tu instancia
                </a>
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
