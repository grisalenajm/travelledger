"use client"

import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useTrips } from "@/hooks/use-trips"
import { useRecentExpenses } from "@/hooks/use-expenses"
import { ExpenseCard } from "@/components/expense-card"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import type { User } from "@/types"

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function ActiveTripSkeleton() {
  return (
    <div className="rounded-xl border-2 border-surface-container-high bg-surface-container-lowest p-5 animate-pulse space-y-2">
      <div className="h-3 w-20 bg-surface-container rounded" />
      <div className="h-5 w-48 bg-surface-container-high rounded" />
      <div className="h-3 w-32 bg-surface-container rounded" />
    </div>
  )
}

function ExpenseSkeleton() {
  return <div className="h-16 rounded-xl bg-surface-container-lowest animate-pulse" />
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const { data: trips, isLoading: tripsLoading } = useTrips("active")
  const { data: recentExpenses, isLoading: expensesLoading } = useRecentExpenses(5)
  const { data: userProfile } = useQuery({
    queryKey: ["users", "me"],
    queryFn: () => api.get<User>("/api/proxy/users/me"),
    enabled: !!session?.accessToken,
  })

  const activeTrip = trips?.[0] ?? null
  const currencyBase = userProfile?.currency_base ?? "EUR"
  const userName = session?.user?.name
  const isLoading = tripsLoading || expensesLoading

  if (!isLoading && !activeTrip && (!recentExpenses || recentExpenses.length === 0)) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-4">
        <span className="text-6xl mb-4 select-none" aria-hidden="true">✈️</span>
        <h1 className="font-headline text-2xl font-bold text-on-surface">Bienvenido a Ledger</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Empieza creando tu primer viaje para registrar gastos.
        </p>
        <Link href="/trips/new" className="mt-6">
          <Button>Crear viaje</Button>
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        <h1 className="font-headline text-2xl font-bold text-on-surface">
          Hola{userName ? `, ${userName}` : ""} 👋
        </h1>

        {tripsLoading ? (
          <ActiveTripSkeleton />
        ) : activeTrip ? (
          <Link
            href={`/trips/${activeTrip.id}`}
            className="block rounded-xl border-2 border-primary bg-surface-container-lowest p-5 shadow-editorial transition-shadow hover:shadow-fab focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <p className="text-xs font-label font-semibold uppercase tracking-wide text-primary mb-1">
              Viaje activo
            </p>
            <p className="font-headline text-base font-semibold text-on-surface">
              {activeTrip.name}
            </p>
            <p className="text-sm text-on-surface-variant mt-0.5">{activeTrip.destination}</p>
            <p className="mt-2 text-xs text-on-surface-variant">
              {fmtDate(activeTrip.start_date)} – {fmtDate(activeTrip.end_date)}
            </p>
          </Link>
        ) : (
          <Link
            href="/trips/new"
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-lowest p-8 text-center transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <p className="text-sm font-medium text-on-surface">No hay viaje activo</p>
            <p className="mt-1 text-xs text-on-surface-variant/70">Pulsa para crear uno nuevo</p>
          </Link>
        )}

        {expensesLoading ? (
          <div className="space-y-2">
            <ExpenseSkeleton />
            <ExpenseSkeleton />
            <ExpenseSkeleton />
          </div>
        ) : recentExpenses && recentExpenses.length > 0 ? (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-headline text-base font-semibold text-on-surface">
                Últimos gastos
              </h2>
              <Link href="/trips" className="text-sm text-primary hover:underline">
                Ver todos →
              </Link>
            </div>
            <div className="space-y-2">
              {recentExpenses.map((expense) => (
                <ExpenseCard key={expense.id} expense={expense} currencyBase={currencyBase} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
