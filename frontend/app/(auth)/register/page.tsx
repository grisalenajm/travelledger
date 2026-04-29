"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const schema = z
  .object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    email: z.string().email("Email inválido"),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirm_password: z.string().min(1, "Confirma tu contraseña"),
    currency_base: z.string().length(3, "Código ISO de 3 letras").toUpperCase(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Las contraseñas no coinciden",
    path: ["confirm_password"],
  })

type RegisterForm = z.infer<typeof schema>

export default function RegisterPage() {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(schema),
    defaultValues: { currency_base: "EUR" },
  })

  const onSubmit = async ({ confirm_password: _ignore, ...data }: RegisterForm) => {
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (res.status === 409) {
        setError("email", { message: "Este email ya está registrado" })
        return
      }

      if (!res.ok) {
        setError("root", { message: "Error al crear la cuenta. Inténtalo de nuevo." })
        return
      }

      const result = await signIn("credentials", {
        redirect: false,
        email: data.email,
        password: data.password,
      })

      if (result?.error) {
        router.push("/login")
        return
      }

      router.push("/")
      router.refresh()
    } catch {
      setError("root", { message: "Error de conexión. Inténtalo de nuevo." })
    }
  }

  return (
    <div className="min-h-screen bg-surface flex">
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
            Start tracking your travel expenses with precision and style.
          </p>
          <p className="mt-12 font-label text-[10px] font-bold uppercase tracking-widest text-primary-fixed/50">
            Your base currency can be changed later in settings
          </p>
        </div>
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
            Create your account
          </h2>
          <p className="mt-1 font-body text-sm text-on-surface-variant">
            Start tracking expenses in minutes
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-10 space-y-7">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="font-label text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">
                Full name
              </label>
              <input
                {...register("name")}
                type="text"
                autoComplete="name"
                placeholder="Your name"
                className="w-full bg-transparent border-b border-outline py-3 text-on-surface
                           placeholder:text-on-surface-variant/40 focus:border-primary
                           focus:outline-none transition-colors font-body text-sm"
              />
              {errors.name && (
                <p className="text-error text-xs font-body">{errors.name.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="font-label text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">
                Email
              </label>
              <input
                {...register("email")}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
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
                Password
              </label>
              <input
                {...register("password")}
                type="password"
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                className="w-full bg-transparent border-b border-outline py-3 text-on-surface
                           placeholder:text-on-surface-variant/40 focus:border-primary
                           focus:outline-none transition-colors font-body text-sm"
              />
              {errors.password && (
                <p className="text-error text-xs font-body">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label className="font-label text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">
                Confirm password
              </label>
              <input
                {...register("confirm_password")}
                type="password"
                autoComplete="new-password"
                placeholder="Repeat your password"
                className="w-full bg-transparent border-b border-outline py-3 text-on-surface
                           placeholder:text-on-surface-variant/40 focus:border-primary
                           focus:outline-none transition-colors font-body text-sm"
              />
              {errors.confirm_password && (
                <p className="text-error text-xs font-body">{errors.confirm_password.message}</p>
              )}
            </div>

            {/* Currency base */}
            <div className="space-y-1.5">
              <label className="font-label text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">
                Base currency
              </label>
              <input
                {...register("currency_base")}
                type="text"
                maxLength={3}
                placeholder="EUR"
                className="w-full bg-transparent border-b border-outline py-3 text-on-surface
                           placeholder:text-on-surface-variant/40 focus:border-primary
                           focus:outline-none transition-colors font-body text-sm uppercase"
              />
              <p className="text-on-surface-variant/60 text-[11px] font-body">
                ISO 4217 code — your reporting currency (e.g. EUR, CHF, USD)
              </p>
              {errors.currency_base && (
                <p className="text-error text-xs font-body">{errors.currency_base.message}</p>
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
              {isSubmitting ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-8 text-center font-body text-sm text-on-surface-variant">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
