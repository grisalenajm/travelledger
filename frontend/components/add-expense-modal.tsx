"use client"

import { useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { Trip } from "@/types/index"
import { useCreateExpense } from "@/hooks/use-expenses"
import { useLoyaltyCards } from "@/hooks/use-loyalty-cards"
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

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

interface AddExpenseModalProps {
  trip: Trip
  open: boolean
  onClose: () => void
}

export function AddExpenseModal({ trip, open, onClose }: AddExpenseModalProps) {
  const createExpense = useCreateExpense()
  const { data: loyaltyCards } = useLoyaltyCards()
  const hasCards = loyaltyCards !== undefined && loyaltyCards.length > 0

  const today = new Date().toISOString().split("T")[0]

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
      currency: trip.primary_currency,
      category: "Dining",
      date: today,
      description: "",
      payment_method: undefined,
      billable: true,
      loyalty_card_id: undefined,
    },
  })

  useEffect(() => {
    if (!open) reset()
    // reset excluded from deps: we only want to reset when open changes,
    // not on every render where RHF may issue a new function reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onSubmit = async (values: FormValues) => {
    await createExpense.mutateAsync({
      trip_id: trip.id,
      amount: values.amount,
      currency: values.currency,
      category: values.category,
      date: values.date,
      description: values.description || null,
      payment_method: values.payment_method || null,
      billable: values.billable,
      loyalty_card_id: values.loyalty_card_id || null,
    })
    onClose()
    reset()
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md">
      <DialogHeader>
        <DialogTitle>Nuevo gasto — {trip.name}</DialogTitle>
      </DialogHeader>

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
            <select id="loyalty_card_id" className={INPUT_CLASS} {...register("loyalty_card_id")}>
              <option value="">— Sin tarjeta —</option>
              {loyaltyCards!.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.alias ?? card.program_name}
                </option>
              ))}
            </select>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={createExpense.isPending}>
            {createExpense.isPending ? "Guardando…" : "Guardar gasto"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
