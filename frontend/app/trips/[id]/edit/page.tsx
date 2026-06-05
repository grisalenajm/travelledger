"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQueryClient } from "@tanstack/react-query"
import { useTrip, useUpdateTrip, useDeleteTrip } from "@/hooks/use-trips"
import { LocationAutocomplete } from "@/components/location-autocomplete"

const CURRENCIES = [
  "EUR", "USD", "GBP", "CHF", "JPY",
  "ARS", "BRL", "MXN", "CAD", "AUD",
  "CNY", "HKD", "SGD", "KRW", "THB", "INR",
  "AED", "TRY", "PLN", "CZK", "HUF", "RON",
  "SEK", "NOK", "DKK",
]

const FIELD_INPUT =
  "block w-full border-0 border-b border-outline-variant bg-transparent pt-1 pb-2 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-0 disabled:opacity-50 appearance-none"

const FIELD_LABEL =
  "block text-[10px] font-label font-bold tracking-widest uppercase text-on-surface-variant mt-5 mb-0"

const schema = z
  .object({
    name: z.string().min(1, "Obligatorio"),
    destination: z.string().min(1, "Obligatorio"),
    destination_lat: z.union([z.number(), z.null(), z.undefined()]).optional(),
    destination_lng: z.union([z.number(), z.null(), z.undefined()]).optional(),
    start_date: z.string().min(1, "Obligatorio"),
    end_date: z.string().min(1, "Obligatorio"),
    primary_currency: z.string().min(1),
    budget: z.coerce.number().min(0),
    budget_currency: z.string().min(1),
    status: z.enum(["active", "closed", "draft"]),
    description: z.string().optional(),
  })
  .refine((d) => d.end_date >= d.start_date, {
    message: "Fin debe ser igual o posterior al inicio",
    path: ["end_date"],
  })

type FormValues = z.infer<typeof schema>

function PageSkeleton() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-20 pb-28 animate-pulse space-y-6">
      <div className="w-full h-36 bg-surface-container-high rounded-2xl" />
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
    </div>
  )
}

export default function TripEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: trip, isLoading, isError } = useTrip(id)
  const updateTrip = useUpdateTrip()
  const deleteTrip = useDeleteTrip()

  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverUploading, setCoverUploading] = useState(false)
  const [coverError, setCoverError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const destinationValue = watch("destination") ?? ""

  // Pre-fill form when trip data arrives
  useEffect(() => {
    if (trip) {
      reset({
        name: trip.name,
        destination: trip.destination,
        destination_lat: trip.destination_lat ?? undefined,
        destination_lng: trip.destination_lng ?? undefined,
        start_date: trip.start_date,
        end_date: trip.end_date,
        primary_currency: trip.primary_currency,
        budget: Number(trip.budget),
        budget_currency: trip.budget_currency,
        status: trip.status,
        description: trip.description ?? "",
      })
    }
  }, [trip, reset])

  // Load existing cover preview — prefer local path, fall back to Paperless URL
  useEffect(() => {
    if (!trip) return
    if (trip.cover_image_path) {
      setCoverPreview(`/api/proxy/trips/${id}/cover`)
      return
    }
    if (!trip.cover_doc_id) return
    fetch(`/api/proxy/trips/${id}/cover-url`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { url: string } | null) => {
        if (data?.url) setCoverPreview(data.url)
      })
      .catch(() => null)
  }, [trip?.cover_image_path, trip?.cover_doc_id, id])

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const objectUrl = URL.createObjectURL(file)
    setCoverPreview(objectUrl)
    setCoverError(null)
    setCoverUploading(true)

    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch(`/api/proxy/trips/${id}/cover`, {
        method: "POST",
        body: fd,
      })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
    } catch {
      setCoverError("Error al subir la imagen. Inténtalo de nuevo.")
      setCoverPreview(null)
    } finally {
      setCoverUploading(false)
    }
  }

  async function handleRegenerateCover() {
    setIsRegenerating(true)
    try {
      const res = await fetch(`/api/proxy/trips/${id}/cover/regenerate`, { method: "POST" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { detail?: string }).detail ?? "Error al regenerar")
      }
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["trips", id] })
        queryClient.invalidateQueries({ queryKey: ["trips"] })
        setCoverPreview(`/api/proxy/trips/${id}/cover?t=${Date.now()}`)
      }, 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al regenerar"
      setCoverError(msg)
    } finally {
      setIsRegenerating(false)
    }
  }

  const onSubmit = async (values: FormValues) => {
    await updateTrip.mutateAsync({
      id,
      data: {
        name: values.name,
        destination: values.destination,
        destination_lat: values.destination_lat ?? null,
        destination_lng: values.destination_lng ?? null,
        start_date: values.start_date,
        end_date: values.end_date,
        primary_currency: values.primary_currency,
        budget: values.budget,
        budget_currency: values.budget_currency,
        status: values.status,
        description: values.description || null,
      },
    })
    router.back()
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    await deleteTrip.mutateAsync(id)
    router.push("/trips")
  }

  const isPending = isSubmitting || updateTrip.isPending || deleteTrip.isPending

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-container-low">
        <header className="fixed top-0 inset-x-0 z-20 h-14 bg-surface border-b border-outline-variant/20 flex items-center px-4 gap-4">
          <div className="w-9 h-9 rounded-full bg-surface-container-high" />
          <div className="flex-1 flex justify-center">
            <div className="h-4 w-28 bg-surface-container-high rounded" />
          </div>
          <div className="w-9 h-9 rounded-full bg-surface-container-high" />
        </header>
        <PageSkeleton />
      </div>
    )
  }

  if (isError || !trip) {
    return (
      <div className="min-h-screen bg-surface-container-low flex items-center justify-center">
        <div className="text-center px-6">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 block mb-4">
            error_outline
          </span>
          <p className="font-headline text-base font-bold text-on-surface">Viaje no encontrado</p>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Volver
          </button>
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
          Editar viaje
        </h1>

        {/* spacer to keep title centered */}
        <div className="w-9 h-9" />
      </header>

      {/* ── Scrollable form ── */}
      <form
        id="trip-edit-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="max-w-lg mx-auto px-5 pt-20 pb-44 md:pb-28"
      >

        {/* Cover image */}
        <div className="mt-4">
          <p className={FIELD_LABEL}>Imagen de portada</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={coverUploading}
            className="mt-3 relative w-full h-36 rounded-2xl overflow-hidden border border-outline-variant bg-surface-container flex items-center justify-center transition-opacity hover:opacity-80 disabled:opacity-60"
          >
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverPreview}
                alt="Portada del viaje"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-on-surface-variant/50">
                <span className="material-symbols-outlined text-4xl leading-none">
                  {coverUploading ? "hourglass_empty" : "add_photo_alternate"}
                </span>
                <span className="text-xs font-label">
                  {coverUploading ? "Subiendo…" : "Añadir imagen"}
                </span>
              </div>
            )}
            {coverUploading && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-white animate-spin">
                  progress_activity
                </span>
              </div>
            )}
          </button>
          {coverError && (
            <p className="mt-1 text-[11px] text-error">{coverError}</p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleCoverChange}
          />

          {/* Botón Regenerar portada */}
          <button
            type="button"
            disabled={isRegenerating || !destinationValue}
            onClick={handleRegenerateCover}
            className="mt-2 flex items-center gap-1.5 text-xs font-label font-semibold text-primary hover:text-primary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className={`material-symbols-outlined text-[14px] leading-none ${isRegenerating ? "animate-spin" : ""}`}>
              refresh
            </span>
            {isRegenerating ? "Regenerando…" : "Regenerar portada con Unsplash"}
          </button>
        </div>

        {/* Nombre */}
        <div>
          <label htmlFor="name" className={FIELD_LABEL}>Nombre *</label>
          <input
            id="name"
            type="text"
            placeholder="Tokyo business trip"
            className={FIELD_INPUT}
            {...register("name")}
          />
          {errors.name && <p className="mt-1 text-[11px] text-error">{errors.name.message}</p>}
        </div>

        {/* Destino */}
        <div>
          <label htmlFor="destination" className={FIELD_LABEL}>Destino *</label>
          <LocationAutocomplete
            value={destinationValue}
            onChange={(val) => setValue("destination", val)}
            onSelect={(place) => {
              setValue("destination", place.name)
              setValue("destination_lat", place.lat)
              setValue("destination_lng", place.lng)
            }}
            placeholder="Busca el destino del viaje…"
            className={FIELD_INPUT}
          />
          {errors.destination && (
            <p className="mt-1 text-[11px] text-error">{errors.destination.message}</p>
          )}
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label htmlFor="start_date" className={FIELD_LABEL}>Inicio *</label>
            <input id="start_date" type="date" className={FIELD_INPUT} {...register("start_date")} />
            {errors.start_date && (
              <p className="mt-1 text-[11px] text-error">{errors.start_date.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="end_date" className={FIELD_LABEL}>Fin *</label>
            <input id="end_date" type="date" className={FIELD_INPUT} {...register("end_date")} />
            {errors.end_date && (
              <p className="mt-1 text-[11px] text-error">{errors.end_date.message}</p>
            )}
          </div>
        </div>

        {/* Moneda principal */}
        <div>
          <label htmlFor="primary_currency" className={FIELD_LABEL}>Moneda principal</label>
          <select id="primary_currency" className={FIELD_INPUT} {...register("primary_currency")}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Presupuesto + Moneda */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label htmlFor="budget" className={FIELD_LABEL}>Presupuesto</label>
            <input
              id="budget"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className={FIELD_INPUT}
              {...register("budget")}
            />
          </div>
          <div>
            <label htmlFor="budget_currency" className={FIELD_LABEL}>Moneda presupuesto</label>
            <select id="budget_currency" className={FIELD_INPUT} {...register("budget_currency")}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Status */}
        <div>
          <label htmlFor="status" className={FIELD_LABEL}>Estado</label>
          <select id="status" className={FIELD_INPUT} {...register("status")}>
            <option value="active">Activo</option>
            <option value="closed">Cerrado</option>
            <option value="draft">Borrador</option>
          </select>
        </div>

        {/* Descripción */}
        <div>
          <label htmlFor="description" className={FIELD_LABEL}>Descripción</label>
          <textarea
            id="description"
            rows={3}
            placeholder="Descripción del viaje"
            className="block w-full border-0 border-b border-outline-variant bg-transparent pt-1 pb-2 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-0 resize-none"
            {...register("description")}
          />
        </div>

      </form>

      {/* ── Fixed footer ── posicionado sobre el bottom nav en móvil */}
      <footer className="fixed bottom-[64px] md:bottom-0 inset-x-0 z-[45] bg-surface border-t border-outline-variant/20">
        <div className="max-w-lg mx-auto px-5 py-3 flex items-center justify-between">

          <button
            type="button"
            onClick={() => { setConfirmDelete(false); router.back() }}
            disabled={isPending}
            className="text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors px-1 disabled:opacity-50"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className={[
                "h-10 px-4 rounded-full text-sm font-label font-semibold text-white transition-colors disabled:opacity-50",
                confirmDelete ? "bg-error/80 animate-pulse" : "bg-error hover:bg-error/90",
              ].join(" ")}
            >
              {deleteTrip.isPending
                ? "Eliminando…"
                : confirmDelete
                ? "¿Confirmar?"
                : "Eliminar viaje"}
            </button>

            <button
              type="submit"
              form="trip-edit-form"
              disabled={isPending}
              className="h-10 px-6 rounded-full text-sm font-label font-semibold text-white bg-primary hover:bg-primary-container transition-colors disabled:opacity-50"
            >
              {updateTrip.isPending ? "Guardando…" : "Guardar"}
            </button>
          </div>

        </div>
      </footer>

    </div>
  )
}
