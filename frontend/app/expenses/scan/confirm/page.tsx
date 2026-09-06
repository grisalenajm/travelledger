"use client"

import { Suspense } from "react"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useExpense, useUpdateExpense } from "@/hooks/use-expenses"
import { useTrips } from "@/hooks/use-trips"
import { usePaymentMethods, useCreatePaymentMethod } from "@/hooks/use-payment-methods"
import { PaymentMethodCombobox } from "@/components/payment-method-combobox"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"
import { useCurrencies } from "@/hooks/use-currencies"
import type { ExpenseCategory } from "@/types/index"

const CATEGORIES: ExpenseCategory[] = [
  "Dining", "Lodging", "Transport", "Culture", "Shopping", "Health", "Other",
]

const FIELD_INPUT =
  "block w-full border-0 border-b border-outline-variant bg-transparent pt-1 pb-2 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-0 disabled:opacity-50 appearance-none"

const FIELD_LABEL =
  "block text-[10px] font-label font-bold tracking-widest uppercase text-on-surface-variant mt-4 mb-0"

function getConfidenceBadge(confidence: number | null) {
  if (confidence === null) return null
  if (confidence >= 0.85) return { label: "Alta confianza", cls: "bg-green-100 text-green-800" }
  if (confidence >= 0.6) return { label: "Revisar campos", cls: "bg-yellow-100 text-yellow-800" }
  return { label: "Baja confianza — revisa con cuidado", cls: "bg-red-100 text-red-800" }
}

function ConfirmPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const expenseId = searchParams.get("expenseId") ?? ""
  const tripIdParam = searchParams.get("tripId") ?? ""

  const { data: expense, isLoading, isError } = useExpense(expenseId)
  const { data: trips, isLoading: tripsLoading } = useTrips()
  const updateExpense = useUpdateExpense()
  const { data: paymentMethods } = usePaymentMethods()
  const createPaymentMethod = useCreatePaymentMethod()
  const { data: currencies } = useCurrencies()

  const [selectedTripId, setSelectedTripId] = useState<string>(tripIdParam)

  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("EUR")
  const [category, setCategory] = useState<ExpenseCategory>("Other")
  const [date, setDate] = useState("")
  const [description, setDescription] = useState("")
  const [billable, setBillable] = useState(true)
  const [locationName, setLocationName] = useState("")
  const [locationLat, setLocationLat] = useState<number | null>(null)
  const [locationLng, setLocationLng] = useState<number | null>(null)
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null)
  const [receiptObjectUrl, setReceiptObjectUrl] = useState<string | null>(null)
  const [receiptContentType, setReceiptContentType] = useState<string | null>(null)

  // tripId efectivo: URL param o selector
  const tripId = selectedTripId || tripIdParam

  const receiptProxyUrl = expense?.has_receipt
    ? `/api/proxy/expenses/${expenseId}/receipt-image`
    : null

  useEffect(() => {
    if (!expense) return
    if (!expense.is_draft) {
      router.replace(tripId ? `/trips/${tripId}` : "/trips")
      return
    }
    setAmount(String(expense.amount))
    setCurrency(expense.currency)
    setCategory(expense.category)
    setDate(expense.date)
    setDescription(expense.description ?? "")
    setBillable(expense.billable)
    if (expense.payment_method_id) setPaymentMethodId(expense.payment_method_id)
    // Localización detectada por OCR/EXIF
    if (expense.location_name) setLocationName(expense.location_name)
    if (expense.location_lat != null) setLocationLat(Number(expense.location_lat))
    if (expense.location_lng != null) setLocationLng(Number(expense.location_lng))
  }, [expense, tripId, router])

  useEffect(() => {
    if (!receiptProxyUrl) return
    let objectUrl: string | null = null
    fetch(receiptProxyUrl)
      .then(async (r) => {
        const ct = r.headers.get("content-type") ?? ""
        setReceiptContentType(ct)
        if (ct.startsWith("image/")) {
          const blob = await r.blob()
          objectUrl = URL.createObjectURL(blob)
          setReceiptObjectUrl(objectUrl)
        }
      })
      .catch(() => {})
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [receiptProxyUrl])

  async function handleSave() {
    if (!tripId) { toast.error("Selecciona un viaje para guardar el gasto"); return }
    const numAmount = parseFloat(amount)
    if (!numAmount || numAmount <= 0) { toast.error("Introduce un importe válido"); return }
    if (!date) { toast.error("Selecciona una fecha"); return }
    try {
      await updateExpense.mutateAsync({
        id: expenseId,
        tripId,
        data: {
          amount: numAmount,
          currency,
          category,
          date,
          description: description || null,
          payment_method_id: paymentMethodId || null,
          billable,
          is_draft: false,
          location_name: locationName || null,
          location_lat: locationLat ?? null,
          location_lng: locationLng ?? null,
        },
      })
      toast.success("Gasto guardado ✓")
      router.push(`/trips/${tripId}`)
    } catch {
      toast.error("Error al guardar el gasto")
    }
  }

  if (!expenseId) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-on-surface-variant text-sm">Parámetros incorrectos.</p>
      </main>
    )
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background">
        <header className="fixed top-0 inset-x-0 z-20 h-14 bg-surface border-b border-outline-variant/20 flex items-center px-4">
          <div className="w-9 h-9 rounded-full bg-surface-container-high animate-pulse" />
          <div className="flex-1 flex justify-center">
            <div className="h-4 w-32 bg-surface-container-high rounded animate-pulse" />
          </div>
        </header>
        <div className="max-w-screen-xl mx-auto px-6 pt-20 pb-32 animate-pulse">
          <div className="h-6 w-40 bg-surface-container-high rounded-full mb-6" />
          <div className="md:grid md:grid-cols-12 md:gap-8">
            <div className="md:col-span-5 h-80 bg-surface-container-high rounded-xl mb-6 md:mb-0" />
            <div className="md:col-span-7 space-y-4">
              {[1,2,3,4,5].map((i) => (<div key={i} className="h-10 bg-surface-container-high rounded" />))}
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (isError || !expense) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-6">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 block mb-4">error_outline</span>
          <p className="font-headline text-base font-bold text-on-surface">Gasto no encontrado</p>
          <p className="mt-1 text-sm text-on-surface-variant">El gasto no existe o no tienes acceso.</p>
          <button type="button" onClick={() => router.push(tripId ? `/trips/${tripId}` : "/trips")} className="mt-6 text-sm text-primary hover:underline">
            Volver al viaje
          </button>
        </div>
      </main>
    )
  }

  const badge = getConfidenceBadge(expense.ocr_confidence)
  const isPending = updateExpense.isPending
  const hasLocation = locationLat != null && locationLng != null

  return (
    <main className="min-h-screen bg-background pb-44 md:pb-32">
      <header className="fixed top-0 inset-x-0 z-20 h-14 bg-surface border-b border-outline-variant/20 flex items-center px-4">
        <button type="button" onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors" aria-label="Volver">
          <span className="material-symbols-outlined text-[22px] leading-none">arrow_back</span>
        </button>
        <h1 className="flex-1 text-center font-headline font-bold text-[15px] text-on-surface">Confirmar gasto</h1>
        <div className="w-9" aria-hidden />
      </header>

      <div className="max-w-screen-xl mx-auto px-6 pt-20">
        {badge && (
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-label font-bold mb-6 ${badge.cls}`}>
            <span className="material-symbols-outlined text-sm">auto_awesome</span>
            {badge.label}
            {expense.ocr_confidence !== null && (
              <span className="opacity-70 ml-1">{Math.round(expense.ocr_confidence * 100)}%</span>
            )}
          </div>
        )}

        {/* Selector de viaje — obligatorio si no llega en URL */}
        {!tripIdParam && (
          <div className="mb-6 p-4 rounded-xl bg-surface-container border border-outline-variant/30">
            <p className="text-sm font-medium text-on-surface mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-primary">luggage</span>
              Selecciona el viaje para este gasto
            </p>
            {tripsLoading ? (
              <div className="h-11 bg-surface-container-high rounded-xl animate-pulse" />
            ) : (
              <select
                value={selectedTripId}
                onChange={(e) => setSelectedTripId(e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-surface-container-lowest border border-outline-variant text-sm text-on-surface focus:border-primary focus:outline-none appearance-none"
              >
                <option value="">Elige un viaje…</option>
                {trips?.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.name} — {trip.destination}
                  </option>
                ))}
              </select>
            )}
            {!selectedTripId && (
              <p className="text-xs text-error mt-2">Debes seleccionar un viaje para guardar el gasto.</p>
            )}
          </div>
        )}

        <div className="md:grid md:grid-cols-12 md:gap-8">
          <div className="md:col-span-5 mb-8 md:mb-0 md:sticky md:top-20 md:self-start">
            {receiptProxyUrl ? (
              receiptContentType?.startsWith("image/") ? (
                <div className="rounded-xl overflow-hidden border border-outline-variant/20 shadow-[0_8px_32px_rgba(26,28,30,0.06)]">
                  {receiptObjectUrl ? (
                    <img src={receiptObjectUrl} alt="Factura escaneada" className="w-full object-contain" style={{ maxHeight: "500px", filter: "grayscale(20%)" }} />
                  ) : (
                    <div className="h-64 bg-surface-container animate-pulse" />
                  )}
                </div>
              ) : receiptContentType?.includes("pdf") ? (
                <a href={receiptProxyUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center h-64 rounded-xl border-2 border-dashed border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-5xl mb-3">picture_as_pdf</span>
                  <span className="text-sm font-medium">Ver PDF</span>
                </a>
              ) : (
                <div className="h-64 rounded-xl bg-surface-container animate-pulse" />
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-64 rounded-xl bg-surface-container-low border-2 border-dashed border-outline-variant/30 text-on-surface-variant">
                <span className="material-symbols-outlined text-5xl mb-3 opacity-40">image_not_supported</span>
                <p className="text-sm">Sin imagen adjunta</p>
              </div>
            )}
          </div>

          <div className="md:col-span-7">
            <label htmlFor="amount" className={FIELD_LABEL}>Importe</label>
            <input id="amount" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
              className="block w-full border-0 border-b-2 border-outline-variant bg-transparent pb-2 text-5xl font-headline font-extrabold text-on-surface placeholder:text-on-surface-variant/30 focus:border-primary focus:outline-none" />

            <label htmlFor="currency" className={FIELD_LABEL}>Moneda</label>
            <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={FIELD_INPUT}>
              {(currencies ?? []).map((c) => (
                <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
              ))}
            </select>

            <p className={FIELD_LABEL}>Categoría</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {CATEGORIES.map((cat) => (
                <button key={cat} type="button" onClick={() => setCategory(cat)}
                  className={["px-4 py-1.5 rounded-full text-xs font-label font-bold transition-colors", category === cat ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"].join(" ")}>
                  {cat}
                </button>
              ))}
            </div>

            <label htmlFor="date" className={FIELD_LABEL}>Fecha</label>
            <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={FIELD_INPUT} />

            <label htmlFor="description" className={FIELD_LABEL}>Descripción</label>
            <input id="description" type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción del gasto" className={FIELD_INPUT} />

            {/* Localización */}
            <label htmlFor="location_name" className={FIELD_LABEL}>
              Ubicación{" "}
              <span className="normal-case font-normal tracking-normal">(opcional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-0 top-1 text-on-surface-variant">
                <span className="material-symbols-outlined text-base leading-none">location_on</span>
              </span>
              <input
                id="location_name"
                type="text"
                value={locationName}
                onChange={(e) => {
                  setLocationName(e.target.value)
                  // Si el usuario escribe manualmente, limpiar coords detectadas
                  if (e.target.value !== expense?.location_name) {
                    setLocationLat(null)
                    setLocationLng(null)
                  }
                }}
                placeholder="Nombre del establecimiento o lugar"
                className={`${FIELD_INPUT} pl-6`}
              />
            </div>
            {hasLocation && (
              <p className="text-xs text-on-surface-variant mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-green-600">my_location</span>
                <span className="text-green-700 font-medium">Ubicación detectada</span>
                <span className="opacity-60">— {locationLat != null ? Number(locationLat).toFixed(4) : '—'}, {locationLng != null ? Number(locationLng).toFixed(4) : '—'}</span>
              </p>
            )}

            <p className={FIELD_LABEL}>Método de pago <span className="normal-case font-normal tracking-normal">(opcional)</span></p>
            <PaymentMethodCombobox
              value={paymentMethodId}
              onChange={setPaymentMethodId}
              methods={paymentMethods ?? []}
              onCreateNew={(name) => createPaymentMethod.mutateAsync(name)}
              className={`${FIELD_INPUT} text-left`}
            />

            <div className="mt-6 pt-4 flex items-center justify-between border-t border-outline-variant/20">
              <div>
                <p className="text-sm font-medium text-on-surface">Facturable</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Es un gasto de empresa</p>
              </div>
              <Switch checked={billable} onCheckedChange={setBillable} />
            </div>
          </div>
        </div>
      </div>

      {/* Footer posicionado sobre el bottom nav en móvil */}
      <footer className="fixed bottom-[64px] md:bottom-0 inset-x-0 z-[45] bg-surface/80 backdrop-blur-xl border-t border-outline-variant/20">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
          <button type="button" onClick={() => router.back()} disabled={isPending} className="text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50 px-1">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !tripId}
            className="h-14 px-10 rounded-full bg-primary text-on-primary text-sm font-label font-bold hover:bg-primary-container transition-colors disabled:opacity-50 shadow-[0_8px_32px_rgba(0,77,100,0.25)]"
          >
            {isPending ? "Guardando…" : "Guardar gasto"}
          </button>
        </div>
      </footer>
    </main>
  )
}

export default function ScanConfirmPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    }>
      <ConfirmPageContent />
    </Suspense>
  )
}
