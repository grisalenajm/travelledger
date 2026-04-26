"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useExpense, useUpdateExpense, useDeleteExpense } from "@/hooks/use-expenses"
import { useLoyaltyCards } from "@/hooks/use-loyalty-cards"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

const CATEGORIES = [
  "Dining",
  "Lodging",
  "Transport",
  "Culture",
  "Shopping",
  "Health",
  "Other",
] as const

const COMMON_CURRENCIES = [
  "EUR", "USD", "GBP", "CHF", "JPY", "ARS", "MXN", "BRL",
  "CAD", "AUD", "CNY", "INR", "THB", "SGD", "NOK", "SEK", "DKK",
]

const INPUT_CLASS =
  "mt-1 block w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"

const schema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: "Introduce un importe válido" })
    .positive("Debe ser mayor que 0"),
  currency: z.string().min(1),
  category: z.enum(CATEGORIES),
  date: z.string().min(1, "Elige una fecha"),
  description: z.string().optional(),
  payment_method: z.enum(["card", "cash", "transfer", "other"]).optional(),
  billable: z.boolean(),
  loyalty_card_id: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-lg px-4 py-8 space-y-5 animate-pulse">
      <div className="h-6 bg-surface-container-high rounded w-40" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="space-y-1">
            <div className="h-3 bg-surface-container rounded w-24" />
            <div className="h-9 bg-surface-container-high rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ExpenseDetailPage() {
  const { id: tripId, expenseId } = useParams<{ id: string; expenseId: string }>()
  const router = useRouter()
  const { data: expense, isLoading, isError } = useExpense(expenseId)
  const { data: loyaltyCards } = useLoyaltyCards()
  const updateExpense = useUpdateExpense()
  const deleteExpense = useDeleteExpense()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: undefined,
      currency: "EUR",
      category: "Dining",
      date: "",
      description: "",
      payment_method: undefined,
      billable: true,
      loyalty_card_id: undefined,
    },
  })

  useEffect(() => {
    if (expense) {
      reset({
        amount: Number(expense.amount),
        currency: expense.currency,
        category: expense.category,
        date: expense.date,
        description: expense.description ?? "",
        payment_method: expense.payment_method ?? undefined,
        billable: expense.billable,
        loyalty_card_id: expense.loyalty_card_id ?? undefined,
      })
    }
  }, [expense, reset])

  const onSubmit = async (values: FormValues) => {
    await updateExpense.mutateAsync({
      id: expenseId,
      tripId,
      data: {
        amount: values.amount,
        currency: values.currency,
        category: values.category,
        date: values.date,
        description: values.description || null,
        payment_method: values.payment_method || null,
        billable: values.billable,
        loyalty_card_id: values.loyalty_card_id || null,
      },
    })
    router.push(`/trips/${tripId}`)
  }

  const handleDelete = async () => {
    await deleteExpense.mutateAsync({ id: expenseId, tripId })
    router.push(`/trips/${tripId}`)
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background">
        <PageSkeleton />
      </main>
    )
  }

  if (isError || !expense) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-4 block">
            error_outline
          </span>
          <p className="font-headline text-base font-semibold text-on-surface">
            Gasto no encontrado
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">
            El gasto no existe o no tienes acceso.
          </p>
          <Button className="mt-4" variant="ghost" onClick={() => router.push(`/trips/${tripId}`)}>
            Volver al viaje
          </Button>
        </div>
      </main>
    )
  }

  const isPending = updateExpense.isPending || deleteExpense.isPending
  const hasCards = loyaltyCards !== undefined && loyaltyCards.length > 0

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-base leading-none">arrow_back</span>
          Volver
        </button>

        <h1 className="font-headline text-xl font-bold text-on-surface">Editar gasto</h1>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {/* Importe + Moneda */}
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="amount">Importe *</Label>
              <input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                className={INPUT_CLASS}
                {...register("amount")}
              />
              {errors.amount && (
                <p className="mt-1 text-xs text-error">{errors.amount.message}</p>
              )}
            </div>

            <div className="w-28">
              <Label htmlFor="currency">Moneda</Label>
              <select id="currency" className={INPUT_CLASS} {...register("currency")}>
                {COMMON_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Categoría */}
          <div>
            <Label htmlFor="category">Categoría *</Label>
            <select id="category" className={INPUT_CLASS} {...register("category")}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1 text-xs text-error">{errors.category.message}</p>
            )}
          </div>

          {/* Fecha */}
          <div>
            <Label htmlFor="date">Fecha *</Label>
            <input id="date" type="date" className={INPUT_CLASS} {...register("date")} />
            {errors.date && (
              <p className="mt-1 text-xs text-error">{errors.date.message}</p>
            )}
          </div>

          {/* Descripción */}
          <div>
            <Label htmlFor="description">Descripción</Label>
            <input
              id="description"
              type="text"
              placeholder="Ej: Cena en restaurante"
              className={INPUT_CLASS}
              {...register("description")}
            />
          </div>

          {/* Método de pago */}
          <div>
            <Label htmlFor="payment_method">Método de pago</Label>
            <select id="payment_method" className={INPUT_CLASS} {...register("payment_method")}>
              <option value="">— Sin especificar —</option>
              <option value="card">Tarjeta</option>
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
              <option value="other">Otro</option>
            </select>
          </div>

          {/* Facturable */}
          <div className="flex items-center justify-between rounded-lg border border-outline-variant px-4 py-3">
            <div>
              <p className="text-sm font-medium text-on-surface">Facturable</p>
              <p className="text-xs text-on-surface-variant">¿Es un gasto de empresa?</p>
            </div>
            <Controller
              name="billable"
              control={control}
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>

          {/* Tarjeta de viajero */}
          {hasCards && (
            <div>
              <Label htmlFor="loyalty_card_id">Tarjeta de viajero</Label>
              <select
                id="loyalty_card_id"
                className={INPUT_CLASS}
                {...register("loyalty_card_id")}
              >
                <option value="">— Sin tarjeta —</option>
                {loyaltyCards!.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.alias ?? card.program_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              disabled={isPending}
            >
              Cancelar
            </Button>

            <div className="flex gap-2">
              {!confirmDelete ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setConfirmDelete(true)}
                  disabled={isPending}
                >
                  Eliminar
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setConfirmDelete(false)}
                    disabled={isPending}
                  >
                    No
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isPending}
                  >
                    {deleteExpense.isPending ? "Eliminando…" : "Confirmar"}
                  </Button>
                </>
              )}

              <Button type="submit" disabled={isPending}>
                {updateExpense.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </main>
  )
}
