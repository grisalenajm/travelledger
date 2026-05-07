"use client"

export const dynamic = "force-dynamic"

import { useState, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTrips } from "@/hooks/use-trips"
import { useUploadReceipt } from "@/hooks/use-ocr"
import { toast } from "@/hooks/use-toast"

type UploadStep = "idle" | "preview" | "uploading"

export default function ScanPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedTripId = searchParams.get("tripId")

  const { data: trips, isLoading: tripsLoading } = useTrips()
  const { mutateAsync: uploadReceipt, isPending } = useUploadReceipt()

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

        {/* Header */}
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface transition-colors mb-3"
          >
            <span className="material-symbols-outlined text-base leading-none">arrow_back</span>
            Volver
          </button>
          <h1 className="font-headline text-2xl font-bold text-on-surface">Escanear ticket</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Sube una imagen o PDF y la IA extraerá los datos automáticamente
          </p>
        </div>

        {/* Drop zone */}
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
                <p className="text-sm text-on-surface-variant">
                  Extrayendo campos con IA
                </p>
              </>
            ) : preview ? (
              <>
                <img
                  src={preview}
                  alt="Vista previa"
                  className="max-h-40 object-contain rounded-xl mb-3"
                />
                <p className="text-sm text-on-surface-variant truncate max-w-full">
                  {selectedFile?.name}
                </p>
              </>
            ) : selectedFile && !preview ? (
              <>
                <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-3">
                  picture_as_pdf
                </span>
                <p className="text-sm text-on-surface-variant truncate max-w-full">
                  {selectedFile.name}
                </p>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-3">
                  upload_file
                </span>
                <p className="font-body text-on-surface font-medium mb-1">
                  Arrastra tu factura aquí
                </p>
                <p className="text-sm text-on-surface-variant">o haz clic para seleccionar</p>
              </>
            )}
          </div>
        </div>

        <p className="text-xs text-on-surface-variant text-center">
          Formatos aceptados: JPG · PNG · WebP · PDF
        </p>

        {/* Action buttons */}
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

        {/* Trip selector */}
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

        {/* Hidden file inputs */}
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
