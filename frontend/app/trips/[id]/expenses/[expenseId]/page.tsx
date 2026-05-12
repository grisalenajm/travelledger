"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useExpense, useUpdateExpense, useDeleteExpense } from "@/hooks/use-expenses"
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
  const updateExpense = useUpdateExpense()
  const deleteExpense = useDeleteExpense()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [receiptObjectUrl, setReceiptObjectUrl] = useState<string | null>(null)
  const [receiptContentType, setReceiptContentType] = useState<string | null>(null)

  const receiptUrl = expense?.has_receipt
    ? `/api/proxy/expenses/${expenseId}/receipt-image`
    : null

  useEffect(() => {
    if (!receiptUrl) return
    let objectUrl: string | null = null

    fetch(receiptUrl)
      .then(async (r) => {
        const ct = r.headers.get("content-type") ?? ""
        setReceiptContentType(ct)
        if (ct.startsWith("image/")) {
          const blob = await r.blob()
          objectUrl = URL.createObjectURL(blob)
          setReceiptObjectUrl(objectUrl)
        } else if (ct.includes("pdf")) {
          setReceiptObjectUrl(receiptUrl)
        }
      })
      .catch(() => {
        setReceiptContentType(null)
        setReceiptObjectUrl(null)
      })

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [receiptUrl])

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

        {/* Row 4 — Método de pago */}
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
        {receiptUrl && (
          <div className="mt-6 pt-6 border-t border-outline-variant/10">
            <p className="text-xs font-label uppercase tracking-widest text-on-surface-variant mb-3">
              Comprobante
            </p>

            {receiptContentType?.startsWith("image/") ? (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="relative w-24 h-24 rounded-xl overflow-hidden border border-outline-variant/20 hover:border-primary transition-colors hover:shadow-md group"
              >
                <img
                  src={receiptObjectUrl ?? receiptUrl}
                  alt="Comprobante"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => console.error("Receipt image failed:", e)}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <span className="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 transition-opacity text-xl">
                    zoom_in
                  </span>
                </div>
              </button>
            ) : receiptContentType?.includes("pdf") ? (
              <a
                href={receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container border border-outline-variant/20 hover:border-primary hover:bg-surface-container-high transition-colors group"
              >
                <span className="material-symbols-outlined text-3xl text-error">
                  picture_as_pdf
                </span>
                <div>
                  <p className="text-sm font-medium text-on-surface">Ver factura PDF</p>
                  <p className="text-xs text-on-surface-variant">Abre en Paperless</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant text-sm ml-2 group-hover:text-primary transition-colors">
                  open_in_new
                </span>
              </a>
            ) : (
              <div className="w-24 h-24 rounded-xl bg-surface-container animate-pulse" />
            )}
          </div>
        )}

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

      {/* Lightbox */}
      {lightboxOpen && receiptUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative max-w-3xl max-h-[90vh] w-full">
            <img
              src={receiptObjectUrl ?? receiptUrl ?? undefined}
              alt="Comprobante"
              className="w-full h-full object-contain rounded-xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
            <a
              href={receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/50 text-white text-xs px-3 py-2 rounded-full hover:bg-black/70 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              Ver en Paperless
            </a>
          </div>
        </div>
      )}

    </div>
  )
}
