"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useExpense, useUpdateExpense, useDeleteExpense } from "@/hooks/use-expenses"
import { useLoyaltyCards } from "@/hooks/use-loyalty-cards"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"

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

// Editorial bottom-border inputs — stitch style
const FIELD_INPUT =
  "block w-full border-0 border-b border-outline-variant bg-transparent pt-1 pb-2 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-0 disabled:opacity-50 appearance-none"

const FIELD_LABEL =
  "block text-[10px] font-label font-bold tracking-widest uppercase text-on-surface-variant mt-4 mb-0"

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
    <div className="max-w-lg mx-auto px-4 pt-20 pb-24 animate-pulse space-y-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="h-2.5 bg-surface-container rounded w-16" />
            <div className="h-7 bg-surface-container-high rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-2.5 bg-surface-container rounded w-16" />
            <div className="h-7 bg-surface-container-high rounded" />
          </div>
        </div>
      ))}
      <div className="space-y-2">
        <div className="h-2.5 bg-surface-container rounded w-20" />
        <div className="h-16 bg-surface-container-high rounded-xl" />
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
  const [receiptLoading, setReceiptLoading] = useState(false)

  const handleOpenReceipt = useCallback(async () => {
    if (!expense?.paperless_doc_id) return
    setReceiptLoading(true)
    try {
      const res = await fetch(`/api/proxy/expenses/${expenseId}/receipt-url`)
      if (!res.ok) throw new Error("receipt-url failed")
      const { url } = await res.json() as { url: string }
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (e) {
      console.error("Failed to open receipt", e)
    } finally {
      setReceiptLoading(false)
    }
  }, [expense?.paperless_doc_id, expenseId])

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
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    await deleteExpense.mutateAsync({ id: expenseId, tripId })
    router.push(`/trips/${tripId}`)
  }

  const isPending = updateExpense.isPending || deleteExpense.isPending

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-container-low">
        {/* Header skeleton */}
        <header className="fixed top-0 inset-x-0 z-20 h-14 bg-surface border-b border-outline-variant/20 flex items-center px-4 gap-4">
          <div className="w-8 h-8 rounded-full bg-surface-container-high" />
          <div className="flex-1 flex justify-center">
            <div className="h-4 w-24 bg-surface-container-high rounded" />
          </div>
          <div className="w-8 h-8 rounded-full bg-surface-container-high" />
        </header>
        <PageSkeleton />
      </div>
    )
  }

  if (isError || !expense) {
    return (
      <div className="min-h-screen bg-surface-container-low flex items-center justify-center">
        <div className="text-center px-6">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 block mb-4">
            error_outline
          </span>
          <p className="font-headline text-base font-bold text-on-surface">Gasto no encontrado</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            El gasto no existe o no tienes acceso.
          </p>
          <Button className="mt-6" variant="ghost" onClick={() => router.push(`/trips/${tripId}`)}>
            Volver al viaje
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-container-low">

      {/* ── Fixed header ── */}
      <header className="fixed top-0 inset-x-0 z-20 h-14 bg-surface border-b border-outline-variant/20 flex items-center px-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
          aria-label="Volver"
        >
          <span className="material-symbols-outlined text-[22px] leading-none">arrow_back</span>
        </button>

        <h1 className="flex-1 text-center font-headline font-bold text-[15px] text-on-surface">
          Editar gasto
        </h1>

        <button
          type="button"
          className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
          aria-label="Más opciones"
        >
          <span className="material-symbols-outlined text-[22px] leading-none">more_vert</span>
        </button>
      </header>

      {/* ── Scrollable form ── */}
      <form
        id="expense-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="max-w-lg mx-auto px-5 pt-20 pb-28"
      >

        {/* OCR draft banner */}
        {expense.is_draft && (
          <div className="flex items-center gap-2 mb-4 px-4 py-3
                          bg-tertiary-fixed/30 rounded-xl border border-tertiary/10">
            <span className="material-symbols-outlined text-tertiary text-sm">auto_awesome</span>
            <p className="text-sm text-tertiary font-medium">
              Datos extraídos automáticamente. Revisa y confirma.
            </p>
            {expense.ocr_confidence !== null && expense.ocr_confidence < 0.6 && (
              <span className="ml-auto text-xs text-tertiary/70 shrink-0">
                Baja confianza — revisa los campos
              </span>
            )}
          </div>
        )}

        {/* Row 1 — Importe + Moneda */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label htmlFor="amount" className={FIELD_LABEL}>Importe</label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              className={FIELD_INPUT}
              {...register("amount")}
            />
            {errors.amount && (
              <p className="mt-1 text-[11px] text-error">{errors.amount.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="currency" className={FIELD_LABEL}>Moneda</label>
            <select id="currency" className={FIELD_INPUT} {...register("currency")}>
              {COMMON_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2 — Categoría + Fecha */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label htmlFor="category" className={FIELD_LABEL}>Categoría</label>
            <select id="category" className={FIELD_INPUT} {...register("category")}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="date" className={FIELD_LABEL}>Fecha</label>
            <input
              id="date"
              type="date"
              className={FIELD_INPUT}
              {...register("date")}
            />
            {errors.date && (
              <p className="mt-1 text-[11px] text-error">{errors.date.message}</p>
            )}
          </div>
        </div>

        {/* Row 3 — Descripción (full width) */}
        <div>
          <label htmlFor="description" className={FIELD_LABEL}>Descripción</label>
          <input
            id="description"
            type="text"
            placeholder="Descripción del gasto"
            className={FIELD_INPUT}
            {...register("description")}
          />
        </div>

        {/* Row 4 — Método de pago + Tarjeta de viajero */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label htmlFor="payment_method" className={FIELD_LABEL}>Método de pago</label>
            <select id="payment_method" className={FIELD_INPUT} {...register("payment_method")}>
              <option value="">Sin especificar</option>
              <option value="card">Tarjeta</option>
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
              <option value="other">Otro</option>
            </select>
          </div>

          <div>
            <label htmlFor="loyalty_card_id" className={FIELD_LABEL}>Tarjeta viajero</label>
            <select id="loyalty_card_id" className={FIELD_INPUT} {...register("loyalty_card_id")}>
              <option value="">Sin tarjeta</option>
              {loyaltyCards?.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.alias ?? card.program_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 5 — Toggle facturable */}
        <div className="mt-6 flex items-center justify-between py-3 border-b border-outline-variant/30">
          <div>
            <p className="text-sm font-medium text-on-surface">Facturable</p>
            <p className="text-xs text-on-surface-variant mt-0.5">¿Es un gasto de empresa?</p>
          </div>
          <Controller
            name="billable"
            control={control}
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>

        {/* Row 6 — Comprobante */}
        <div className="mt-6">
          <p className={FIELD_LABEL}>Comprobante</p>
          {expense.paperless_doc_id ? (
            <button
              type="button"
              onClick={handleOpenReceipt}
              disabled={receiptLoading}
              className="mt-3 w-full flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-4 text-left transition-colors hover:bg-surface-container disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-2xl leading-none select-none text-primary">
                {receiptLoading ? "hourglass_empty" : "receipt_long"}
              </span>
              <span className="text-sm font-medium text-on-surface flex-1">
                {receiptLoading ? "Abriendo…" : `Comprobante #${expense.paperless_doc_id}`}
              </span>
              <span className="material-symbols-outlined text-base text-on-surface-variant/60 leading-none">
                open_in_new
              </span>
            </button>
          ) : (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-4 py-4">
              <span className="material-symbols-outlined text-2xl leading-none select-none text-on-surface-variant/40">
                receipt_long
              </span>
              <span className="text-sm text-on-surface-variant">
                Sin comprobante adjunto
              </span>
            </div>
          )}
        </div>

      </form>

      {/* ── Fixed footer ── */}
      <footer className="fixed bottom-0 inset-x-0 z-20 bg-surface border-t border-outline-variant/20">
        <div className="max-w-lg mx-auto px-5 py-3 flex items-center justify-between">

          {/* Cancelar */}
          <button
            type="button"
            onClick={() => { setConfirmDelete(false); router.back() }}
            disabled={isPending}
            className="text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors px-1 disabled:opacity-50"
          >
            Cancelar
          </button>

          {/* Eliminar + Guardar */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className={[
                "h-10 px-4 rounded-full text-sm font-label font-semibold text-white transition-colors disabled:opacity-50",
                confirmDelete
                  ? "bg-error/80 animate-pulse"
                  : "bg-error hover:bg-error/90",
              ].join(" ")}
            >
              {deleteExpense.isPending
                ? "Eliminando…"
                : confirmDelete
                ? "¿Confirmar?"
                : "Eliminar"}
            </button>

            <button
              type="submit"
              form="expense-form"
              disabled={isPending}
              className="h-10 px-6 rounded-full text-sm font-label font-semibold text-white bg-primary hover:bg-primary-container transition-colors disabled:opacity-50"
            >
              {updateExpense.isPending ? "Guardando…" : "Guardar"}
            </button>
          </div>

        </div>
      </footer>

    </div>
  )
}
