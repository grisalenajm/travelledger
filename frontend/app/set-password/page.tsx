"use client"

import { useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const PASSWORD_RE =
  /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/

const schema = z
  .object({
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

export default function SetPasswordPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  // Si no hay sesión activa → esperar
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse space-y-4 w-80">
          <div className="h-6 bg-surface-container-high rounded w-48 mx-auto" />
          <div className="h-10 bg-surface-container-high rounded" />
        </div>
      </div>
    )
  }

  // Si el usuario no tiene must_change_password → redirigir a home
  if (status === "authenticated" && !session?.user?.mustChangePassword) {
    router.replace("/")
    return null
  }

  const onSubmit = async (data: FormValues) => {
    try {
      const res = await fetch("/api/proxy/users/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: data.password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError("root", { message: body.detail ?? "Error al cambiar la contraseña" })
        return
      }
    } catch {
      setError("root", { message: "Error de conexión. Inténtalo de nuevo." })
      return
    }

    // Cerrar sesión para forzar un nuevo login con el JWT actualizado (sin mustChangePassword)
    signOut({ callbackUrl: "/login?password_changed=1" })
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <span className="material-symbols-outlined text-5xl text-primary">
            lock_reset
          </span>
          <h1 className="font-headline text-2xl font-bold text-on-surface">
            Cambio de contraseña requerido
          </h1>
          <p className="font-body text-sm text-on-surface-variant">
            Por seguridad, establece una nueva contraseña antes de continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">
          {/* Nueva contraseña */}
          <div className="space-y-1.5">
            <label className="font-label text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">
              Nueva contraseña
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
            {isSubmitting ? "Guardando…" : "Establecer contraseña"}
          </button>
        </form>
      </div>
    </div>
  )
}
