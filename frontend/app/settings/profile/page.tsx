"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { User } from "@/types"

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "JPY", "ARS", "BRL", "MXN", "CAD", "AUD"]

const INPUT_CLASS =
  "mt-1 block w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"

export default function ProfilePage() {
  const { data: session } = useSession()
  const qc = useQueryClient()

  const [name, setName] = useState("")
  const [currency, setCurrency] = useState("EUR")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: user, isLoading } = useQuery({
    queryKey: ["users", "me"],
    queryFn: () => api.get<User>("/api/proxy/users/me"),
    enabled: !!session?.accessToken,
  })

  useEffect(() => {
    if (user) {
      setName(user.name)
      setCurrency(user.currency_base)
    }
  }, [user])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await api.put<User>("/api/proxy/users/me", {
        name: name.trim(),
        currency_base: currency,
      })
      qc.invalidateQueries({ queryKey: ["users", "me"] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError("Error al guardar. Inténtalo de nuevo.")
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-4 py-8 space-y-6 animate-pulse">
          <div className="h-7 bg-surface-container-high rounded w-32" />
          <div className="h-4 bg-surface-container rounded w-48" />
          <div className="space-y-4">
            <div className="h-14 bg-surface-container-lowest rounded-xl" />
            <div className="h-14 bg-surface-container-lowest rounded-xl" />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        <div>
          <h1 className="font-headline text-2xl font-bold text-on-surface">Perfil</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {user?.email ?? session?.user?.email}
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <Label htmlFor="name">Nombre</Label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              className={INPUT_CLASS}
              required
            />
          </div>

          <div>
            <Label htmlFor="currency_base">Moneda base</Label>
            <p className="mt-0.5 mb-1 text-xs text-on-surface-variant">
              Usada para totales y presupuestos en todos los viajes
            </p>
            <select
              id="currency_base"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={INPUT_CLASS}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          {saved && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
              <span className="material-symbols-outlined text-base leading-none">check_circle</span>
              Cambios guardados correctamente
            </p>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </form>
      </div>
    </main>
  )
}
