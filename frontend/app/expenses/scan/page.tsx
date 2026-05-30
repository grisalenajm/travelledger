"use client"

import { Suspense } from "react"
import { useState, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTrips } from "@/hooks/use-trips"
import { useUploadReceipt } from "@/hooks/use-ocr"
import { useSettings } from "@/hooks/use-settings"
import { toast } from "@/hooks/use-toast"

type UploadStep = "idle" | "preview" | "uploading"

function ScanPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedTripId = searchParams.get("tripId")

  const { data: trips, isLoading: tripsLoading } = useTrips()
  const { mutateAsync: uploadReceipt, isPending } = useUploadReceipt()
  const { data: settingsData } = useSettings()
  const ocrProvider = settingsData?.ocr_provider ?? "claude"

  const [selectedTripId, setSelectedTripId] = useState<string>(preselectedTripId ?? "")
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [step, setStep] = useState<UploadStep>("idle")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const today = new Date().toISOString().split("T")[0]

  useEffect(() => {
    if (!trips || preselectedTripId) return
    const active = trips.filter((t) => t.start_date <= today && t.end_date >= today)
    if (active.length === 1) setSelectedTripId(active[0].id)
  }, [trips, preselectedTripId, today])

  useEffect(() => {
    if (!tripsLoading && trips && trips.length === 0) {
      toast.warning("Crea un viaje primero")
      router.push("/trips/new")
    }
  }, [trips, tripsLoading, router])

  function applyFile(file: File, currentTripId: string) {
    if (step === "uploading") return
    if (preview) URL.revokeObjectURL(preview)

    if (!currentTripId) {
      toast.warning("Selecciona un viaje antes de subir la factura")
      return
    }

    setSelectedFile(file)
    if (file.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(file))
    } else {
      setPreview(null)
    }
    setStep("uploading")

    uploadReceipt({ file, tripId: currentTripId })
      .then((expense) => {
        if (expense.warning) {
          toast.warning(expense.warning)
        }
        router.push(`/expenses/scan/confirm?expenseId=${expense.id}&tripId=${currentTripId}`)
      })
      .catch((e: unknown) => {
        setStep("preview")
        toast.error(e instanceof Error ? e.message : "Error al analizar la factura")
      })
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave() {
    setDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) applyFile(file, selectedTripId)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) applyFile(file, selectedTripId)
    e.target.value = ""
  }

  const isUploading = step === "uploading" || isPending

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface transition-colors mb-3"
          >
            <span className="material-symbols-outlined text-base leading-none">arrow_back</span>
            Volver
          </button>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-headline text-2xl font-bold text-on-surface">Escanear ticket</h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                Sube una imagen o PDF y la IA extraerá los datos automáticamente
              </p>
            </div>
            {/* Badge motor OCR activo */}
            <span className="flex-shrink-0 inline-flex items-center gap-1 mt-1 px-2 py-1 rounded-full bg-surface-container text-on-surface-variant text-[11px] font-label font-medium border border-outline-variant">
              <span className="material-symbols-outlined text-[13px]">smart_toy</span>
              {{
                claude: "Claude Haiku",
                openai: "GPT-4o mini",
                ollama: "Ollama",
                gemini: "Gemini Flash",
              }[ocrProvider] ?? ocrProvider}
            </span>
          </div>
        </div>

        <div
          role={isUploading ? undefined : "button"}
          tabIndex={isUploading ? undefined : 0}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && !isUploading && fileInputRef.current?.click()}
          className={[
            "relative rounded-xl overflow-hidden transition-colors",
            isUploading ? "cursor-default" : "cursor-pointer",
            "border-2 border-dashed",
            isUploading
              ? "border-primary/40 bg-surface-container-low"
              : dragOver
              ? "border-primary bg-primary/10"
              : "border-outline-variant hover:border-primary hover:bg-primary/5",
          ].join(" ")}
          style={{ minHeight: "260px" }}
        >
          {isUploading && <div className="scanning-line" />}
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            {isUploading ? (
              <>
                <span className="material-symbols-outlined text-5xl text-primary mb-4 animate-pulse">
                  document_scanner
                </span>
                <p className="font-headline text-base font-bold text-on-surface mb-1">
                  Analizando tu factura…
                </p>
                <p className="text-sm text-on-surface-variant">Extrayendo campos con IA</p>
              </>
            ) : preview ? (
              <>
                <img src={preview} alt="Vista previa" className="max-h-40 object-contain rounded-xl mb-3" />
                <p className="text-sm text-on-surface-variant truncate max-w-full">{selectedFile?.name}</p>
              </>
            ) : selectedFile && !preview ? (
              <>
                <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-3">picture_as_pdf</span>
                <p className="text-sm text-on-surface-variant truncate max-w-full">{selectedFile.name}</p>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-3">upload_file</span>
                <p className="font-body text-on-surface font-medium mb-1">Arrastra tu factura aquí</p>
                <p className="text-sm text-on-surface-variant">o haz clic para seleccionar</p>
              </>
            )}
          </div>
        </div>

        <p className="text-xs text-on-surface-variant text-center">
          Formatos aceptados: JPG · PNG · WebP · PDF
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 h-11 rounded-full border border-outline-variant text-sm font-label font-medium text-on-surface hover:bg-surface-container transition-colors disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-base">folder_open</span>
            Seleccionar archivo
          </button>
          <button
            type="button"
            disabled={isUploading}
            onClick={() => cameraInputRef.current?.click()}
            className="md:hidden flex items-center justify-center gap-2 h-11 rounded-full bg-primary text-on-primary text-sm font-label font-bold hover:bg-primary-container transition-colors disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-base">photo_camera</span>
            Usar cámara
          </button>
        </div>

        <div>
          <p className="text-[10px] font-label font-bold tracking-widest uppercase text-on-surface-variant mb-2">
            Viaje
          </p>
          {tripsLoading ? (
            <div className="h-11 bg-surface-container rounded-xl animate-pulse" />
          ) : (
            <select
              value={selectedTripId}
              disabled={isUploading}
              onChange={(e) => setSelectedTripId(e.target.value)}
              className="w-full h-11 px-4 rounded-xl bg-surface-container-lowest border border-outline-variant text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-40 appearance-none"
            >
              <option value="">Selecciona un viaje…</option>
              {trips?.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.name} — {trip.destination}
                </option>
              ))}
            </select>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </main>
  )
}

export default function ScanPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    }>
      <ScanPageContent />
    </Suspense>
  )
}
