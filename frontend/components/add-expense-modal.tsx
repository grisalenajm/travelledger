"use client"

import { useEffect, useRef, useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQueryClient } from "@tanstack/react-query"
import type { Trip, Expense } from "@/types/index"
import { useCreateExpense, useUpdateExpense } from "@/hooks/use-expenses"
import { usePaymentMethods, useCreatePaymentMethod } from "@/hooks/use-payment-methods"
import { PaymentMethodCombobox } from "@/components/payment-method-combobox"
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import { HotelAutocomplete } from "@/components/hotel-autocomplete"
import { useCurrencies } from "@/hooks/use-currencies"

const CATEGORIES = [
  "Dining",
  "Lodging",
  "Transport",
  "Culture",
  "Shopping",
  "Health",
  "Other",
] as const

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
  payment_method_id: z.string().optional().nullable(),
  billable: z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface AddExpenseModalProps {
  trip: Trip
  open: boolean
  onClose: () => void
  expense?: Expense
}

export function AddExpenseModal({ trip, open, onClose, expense }: AddExpenseModalProps) {
  const isEdit = !!expense
  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()
  const createPaymentMethod = useCreatePaymentMethod()
  const queryClient = useQueryClient()
  const { data: paymentMethods } = usePaymentMethods()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const today = new Date().toISOString().split("T")[0]

  const { data: currencies } = useCurrencies()

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: undefined,
      currency: trip.primary_currency,
      category: "Dining",
      date: today,
      description: "",
      payment_method_id: null,
      billable: true,
    },
  })

  useEffect(() => {
    if (!open) {
      reset({
        amount: undefined,
        currency: trip.primary_currency,
        category: "Dining",
        date: today,
        description: "",
        payment_method_id: null,
        billable: true,
      })
      setImageFile(null)
      setImagePreview(null)
    } else if (expense) {
      reset({
        amount: Number(expense.amount),
        currency: expense.currency,
        category: expense.category,
        date: expense.date,
        description: expense.description ?? "",
        payment_method_id: expense.payment_method_id ?? null,
        billable: expense.billable,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense?.id])

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEdit && expense) {
        await updateExpense.mutateAsync({
          id: expense.id,
          tripId: expense.trip_id,
          data: {
            amount: values.amount,
            currency: values.currency,
            category: values.category,
            date: values.date,
            description: values.description || null,
            payment_method_id: values.payment_method_id || null,
            billable: values.billable,
          },
        })
      } else if (imageFile) {
        const formData = new FormData()
        const fields: Record<string, string> = {
          trip_id: trip.id,
          amount: String(values.amount),
          currency: values.currency,
          category: values.category,
          date: values.date,
          billable: String(values.billable),
        }
        Object.entries(fields).forEach(([k, v]) => formData.append(k, v))
        if (values.description) formData.append("description", values.description)
        if (values.payment_method_id) formData.append("payment_method_id", values.payment_method_id)
        formData.append("image", imageFile)
        await api.post<Expense>("/api/proxy/expenses/", formData)
        queryClient.invalidateQueries({ queryKey: ["expenses", trip.id] })
        queryClient.invalidateQueries({ queryKey: ["trips", trip.id, "summary"] })
      } else {
        await createExpense.mutateAsync({
          trip_id: trip.id,
          amount: values.amount,
          currency: values.currency,
          category: values.category,
          date: values.date,
          description: values.description || null,
          payment_method_id: values.payment_method_id || null,
          billable: values.billable,
        })
      }
      reset()
      setImageFile(null)
      setImagePreview(null)
      onClose()
    } catch (error) {
      console.error("Error saving expense:", error)
    }
  }

  const isPending = createExpense.isPending || updateExpense.isPending

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md">
      <DialogHeader>
        <DialogTitle>
          {isEdit ? "Editar gasto" : "Nuevo gasto"} — {trip.name}
        </DialogTitle>
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
            <select
              id="currency"
              className={INPUT_CLASS}
              {...register("currency")}
              value={watch("currency") ?? ""}
            >
              {(currencies ?? []).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
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

        {/* Descripción — autocompletado hotel cuando categoría es Lodging */}
        <div>
          <Label htmlFor="description">Descripción</Label>
          {watch("category") === "Lodging" ? (
            <HotelAutocomplete
              value={watch("description") ?? ""}
              onChange={(v) => setValue("description", v)}
              onSelect={(hotel) => setValue("description", hotel.name)}
              placeholder="Nombre del hotel..."
              className={INPUT_CLASS}
            />
          ) : (
            <input
              id="description"
              type="text"
              placeholder="Ej: Cena en restaurante"
              className={INPUT_CLASS}
              {...register("description")}
            />
          )}
        </div>

        {/* Método de pago */}
        <div>
          <Label>Método de pago</Label>
          <Controller
            name="payment_method_id"
            control={control}
            render={({ field }) => (
              <PaymentMethodCombobox
                value={field.value ?? null}
                onChange={field.onChange}
                methods={paymentMethods ?? []}
                onCreateNew={(name) => createPaymentMethod.mutateAsync(name)}
                className={INPUT_CLASS}
              />
            )}
          />
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

        {/* Comprobante */}
        {!isEdit && (
          <div>
            <Label>Comprobante</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setImageFile(file)
                setImagePreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : null)
              }}
            />
            {!imageFile ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-lg p-4 text-center text-muted-foreground hover:border-primary transition-colors"
              >
                📎 Adjuntar imagen o PDF
              </button>
            ) : (
              <div className="relative border border-border rounded-lg p-3 flex items-center gap-3">
                {imagePreview && (
                  <img src={imagePreview} className="h-12 w-12 object-cover rounded" alt="" />
                )}
                <span className="text-sm flex-1 truncate">{imageFile.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null)
                    setImagePreview(null)
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending
              ? "Guardando…"
              : isEdit
              ? "Actualizar gasto"
              : "Guardar gasto"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
