"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Link from "next/link"
import { useT } from "@/lib/i18n"
import { LanguageSelector } from "@/components/language-selector"

const schema = z
  .object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    path: ["confirm_password"],
    message: "passwords_no_match",
  })

type RegisterForm = z.infer<typeof schema>

const inputClass =
  "w-full bg-transparent border-b border-outline py-3 text-on-surface " +
  "placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none " +
  "transition-colors font-body text-sm"
const labelClass =
  "font-label text-[10px] font-bold tracking-widest uppercase text-on-surface-variant"

export default function RegisterPage() {
  const router = useRouter()
  const t = useT()
  const [regStatus, setRegStatus] = useState<"loading" | "open" | "closed">("loading")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    fetch("/api/proxy/auth/status")
      .then((r) => r.json())
      .then((d: { has_users: boolean; registration_open: boolean }) => {
        if (!d.has_users) {
          router.replace("/setup")
        } else {
          setRegStatus(d.registration_open ? "open" : "closed")
        }
      })
      .catch(() => setRegStatus("open"))
  }, [router])

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(schema) })

  const password = watch("password", "")
  const confirmPassword = watch("confirm_password", "")
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword

  const onSubmit = async (data: RegisterForm) => {
    try {
      const res = await fetch("/api/proxy/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, email: data.email, password: data.password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { detail?: string }
        setError("root", { message: body.detail ?? t("auth.register_error") })
        return
      }
      router.push("/login?registered=1")
    } catch {
      setError("root", { message: t("common.error") })
    }
  }

  if (regStatus === "loading") {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <span className="material-symbols-outlined text-2xl text-on-surface-variant animate-spin">
          progress_activity
        </span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex relative">
      <div className="absolute top-4 right-4 z-10">
        <LanguageSelector />
      </div>

      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-[45%] bg-primary items-center justify-center p-16 relative overflow-hidden">
        <div className="relative z-10 max-w-sm">
          <div className="w-12 h-12 rounded-xl bg-primary-fixed/20 flex items-center justify-center mb-8">
            <span className="material-symbols-outlined text-primary-fixed text-2xl">flight_takeoff</span>
          </div>
          <h1 className="font-headline text-5xl font-extrabold tracking-tight text-on-primary leading-none">
            Ledger
          </h1>
          <p className="mt-4 font-body text-primary-fixed/70 text-lg leading-relaxed">
            Cada viaje, cada gasto — registrado con precisión.
          </p>
        </div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-primary-container opacity-40" />
        <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-primary-container opacity-20" />
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-10 text-center">
            <h1 className="font-headline text-4xl font-extrabold text-primary">Ledger</h1>
          </div>

          <h2 className="font-headline text-2xl font-bold text-on-surface">
            {t("auth.register_title")}
          </h2>
          <p className="mt-1 font-body text-sm text-on-surface-variant">
            {t("auth.register_subtitle")}
          </p>

          {regStatus === "closed" ? (
            <div className="mt-10 bg-surface-container rounded-2xl px-6 py-8 text-center space-y-4">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant">lock</span>
              <p className="font-body text-sm text-on-surface">{t("auth.registration_closed")}</p>
              <Link href="/login" className="block text-primary text-sm font-medium hover:underline">
                {t("auth.back_to_login")}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="mt-10 space-y-7" noValidate>
              {/* Name */}
              <div className="space-y-1.5">
                <label className={labelClass}>{t("auth.name")}</label>
                <input
                  {...register("name")}
                  type="text"
                  autoComplete="name"
                  placeholder={t("auth.name_placeholder")}
                  className={inputClass}
                />
                {errors.name && (
                  <p className="text-error text-xs font-body">{t("auth.name_required")}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className={labelClass}>Email</label>
                <input
                  {...register("email")}
                  type="email"
                  autoComplete="email"
                  placeholder="tu@ejemplo.com"
                  className={inputClass}
                />
                {errors.email && (
                  <p className="text-error text-xs font-body">{t("auth.email_invalid")}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className={labelClass}>{t("auth.password")}</label>
                <div className="relative">
                  <input
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-0 bottom-2.5 text-on-surface-variant hover:text-on-surface transition-colors"
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
                {errors.password && (
                  <p className="text-error text-xs font-body">{t("auth.password_required")}</p>
                )}
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <label className={labelClass}>{t("auth.confirm_password")}</label>
                <div className="relative">
                  <input
                    {...register("confirm_password")}
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-0 bottom-2.5 text-on-surface-variant hover:text-on-surface transition-colors"
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showConfirm ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
                {(passwordsMismatch || errors.confirm_password) && (
                  <p className="text-error text-xs font-body">{t("auth.passwords_no_match")}</p>
                )}
              </div>

              {errors.root && (
                <div className="bg-error-container rounded-xl px-4 py-3">
                  <p className="text-error text-sm font-body">{errors.root.message}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || passwordsMismatch}
                className="mt-2 w-full bg-primary text-on-primary py-4 rounded-full
                           font-label font-bold text-sm uppercase tracking-wider
                           hover:bg-primary-container transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed
                           shadow-[0_8px_32px_rgba(0,77,100,0.25)]"
              >
                {isSubmitting ? t("common.loading") : t("auth.register")}
              </button>

              <p className="text-center text-sm text-on-surface-variant font-body">
                {t("auth.have_account")}{" "}
                <Link href="/login" className="text-primary hover:underline font-medium">
                  {t("auth.login")}
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
