"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useCreateTrip } from "@/hooks/use-trips"
import { Button } from "@/components/ui/button"

const CURRENCIES = [
  "EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "SEK", "NOK", "DKK",
  "ARS", "BRL", "MXN", "CLP", "COP", "PEN",
  "CNY", "HKD", "SGD", "KRW", "THB", "INR",
  "AED", "TRY", "PLN", "CZK", "HUF", "RON",
]

const schema = z
  .object({
    name: z.string().min(1, "Nombre requerido"),
    destination: z.string().min(1, "Destino requerido"),
    start_date: z.string().min(1, "Fecha inicio requerida"),
    end_date: z.string().min(1, "Fecha fin requerida"),
    primary_currency: z.string().min(1, "Moneda principal requerida"),
    description: z.string().optional(),
    budget: z.coerce.number().min(0, "El presupuesto no puede ser negativo").optional(),
    budget_currency: z.string().min(1),
  })
  .refine(
    (d) => !d.start_date || !d.end_date || d.end_date >= d.start_date,
    { message: "La fecha de fin debe ser igual o posterior al inicio", path: ["end_date"] },
  )

type FormValues = z.infer<typeof schema>

const inputClass =
  "w-full bg-transparent border-b border-outline py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none transition-colors font-body text-sm"

const selectClass =
  "w-full bg-transparent border-b border-outline py-3 text-on-surface focus:border-primary focus:outline-none transition-colors font-body text-sm appearance-none cursor-pointer"

const labelClass =
  "font-label text-[10px] font-bold tracking-widest uppercase text-on-surface-variant"

const errorClass = "text-error text-xs font-body mt-1"

export default function NewTripPage() {
  const router = useRouter()
  const createTrip = useCreateTrip()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      primary_currency: "",
      budget_currency: "EUR",
    },
  })

  const onSubmit = async (data: FormValues) => {
    try {
      const trip = await createTrip.mutateAsync({
        name: data.name,
        destination: data.destination,
        start_date: data.start_date,
        end_date: data.end_date,
        primary_currency: data.primary_currency,
        description: data.description || null,
        budget: data.budget ?? 0,
        budget_currency: data.budget_currency,
      })
      router.push(`/trips/${trip.id}`)
    } catch {
      setError("root", { message: "Error al crear el viaje. Inténtalo de nuevo." })
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full p-2 hover:bg-surface-container transition-colors"
            aria-label="Volver"
          >
            <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
          </button>
          <h1 className="font-headline text-2xl font-bold text-on-surface">Nuevo viaje</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">
          <div className="space-y-1.5">
            <label className={labelClass}>Nombre *</label>
            <input
              {...register("name")}
              placeholder="Tokyo business trip"
              className={inputClass}
            />
            {errors.name && <p className={errorClass}>{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Destino *</label>
            <input
              {...register("destination")}
              placeholder="Tokyo, Japan"
              className={inputClass}
            />
            {errors.destination && <p className={errorClass}>{errors.destination.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}>Inicio *</label>
              <input {...register("start_date")} type="date" className={inputClass} />
              {errors.start_date && <p className={errorClass}>{errors.start_date.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Fin *</label>
              <input {...register("end_date")} type="date" className={inputClass} />
              {errors.end_date && <p className={errorClass}>{errors.end_date.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Moneda principal *</label>
            <select {...register("primary_currency")} className={selectClass}>
              <option value="" disabled>Selecciona una moneda</option>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.primary_currency && (
              <p className={errorClass}>{errors.primary_currency.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Descripción</label>
            <input
              {...register("description")}
              placeholder="Visita a clientes en Tokio"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}>Presupuesto</label>
              <input
                {...register("budget")}
                type="number"
                min="0"
                step="0.01"
                placeholder="2000"
                className={inputClass}
              />
              {errors.budget && <p className={errorClass}>{errors.budget.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Moneda presupuesto</label>
              <select {...register("budget_currency")} className={selectClass}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {errors.root && (
            <div className="bg-error-container rounded-xl px-4 py-3">
              <p className="text-error text-sm font-body">{errors.root.message}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => router.back()}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? "Creando…" : "Crear viaje"}
            </Button>
          </div>
        </form>
      </div>
    </main>
  )
}
