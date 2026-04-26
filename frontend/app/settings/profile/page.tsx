"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { api } from "@/lib/api"
import type { User } from "@/types"
import { Button } from "@/components/ui/button"

const CURRENCIES = [
  "EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "SEK", "NOK", "DKK",
  "ARS", "BRL", "MXN", "CLP", "COP", "PEN",
  "CNY", "HKD", "SGD", "KRW", "THB", "INR",
  "AED", "TRY", "PLN", "CZK", "HUF", "RON",
]

const labelClass = "font-label text-[10px] font-bold tracking-widest uppercase text-on-surface-variant"
const inputClass = "w-full bg-transparent border-b border-outline py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none transition-colors font-body text-sm"
const selectClass = "w-full bg-transparent border-b border-outline py-3 text-on-surface focus:border-primary focus:outline-none transition-colors font-body text-sm appearance-none cursor-pointer"
const errorClass = "text-error text-xs font-body mt-1"

const schema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  currency_base: z.string().min(1, "Selecciona una moneda"),
})

type FormValues = z.infer<typeof schema>

export default function ProfilePage() {
  const [saved, setSaved] = useState(false)
  const queryClient = useQueryClient()

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["me"],
    queryFn: () => api.get<User>("/api/proxy/users/me"),
  })

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: user ? { name: user.name, currency_base: user.currency_base } : undefined,
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => api.put<User>("/api/proxy/users/me", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
    onError: () => {
      setError("root", { message: "Error al guardar. Inténtalo de nuevo." })
    },
  })

  if (isLoading || !user) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-lg px-4 py-8 animate-pulse space-y-6">
          <div className="space-y-1">
            <div className="h-7 bg-surface-container-high rounded w-32" />
            <div className="h-4 bg-surface-container rounded w-52" />
          </div>
          <div className="h-10 bg-surface-container-high rounded" />
          <div className="h-10 bg-surface-container-high rounded" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-8 space-y-8">
        <div>
          <h1 className="font-headline text-2xl font-bold text-on-surface">Perfil</h1>
          <p className="mt-1 text-sm text-on-surface-variant">{user.email}</p>
        </div>

        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          className="space-y-7"
        >
          <div className="space-y-1.5">
            <label className={labelClass}>Nombre</label>
            <input
              {...register("name")}
              placeholder="Tu nombre"
              className={inputClass}
            />
            {errors.name && <p className={errorClass}>{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Moneda base (reporting)</label>
            <select {...register("currency_base")} className={selectClass}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.currency_base && (
              <p className={errorClass}>{errors.currency_base.message}</p>
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
      </div>
    </main>
  )
}
