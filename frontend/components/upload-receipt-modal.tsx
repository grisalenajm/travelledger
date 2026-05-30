"use client"

import { useRef, useState, useEffect } from "react"
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useReceiptUpload } from "@/hooks/use-receipt-upload"
import type { Expense } from "@/types/index"

interface UploadReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  tripId: string
  onSuccess: (expense: Expense) => void
}

export function UploadReceiptModal({ isOpen, onClose, tripId, onSuccess }: UploadReceiptModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const { upload, isUploading, error } = useReceiptUpload()

  function applyFile(file: File) {
    setSelectedFile(file)
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file)
      setPreview(url)
    } else {
      setPreview(null)
    }
  }

  function cleanup() {
    if (preview) URL.revokeObjectURL(preview)
    setSelectedFile(null)
    setPreview(null)
    setDragOver(false)
  }

  function handleClose() {
    cleanup()
    onClose()
  }

  useEffect(() => {
    if (!isOpen) cleanup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

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
    if (file) applyFile(file)
  }

  function handleClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) applyFile(file)
  }

  async function handleAnalyze() {
    if (!selectedFile) return
    const expense = await upload(selectedFile, tripId)
    if (expense) {
      cleanup()
      onSuccess(expense)
    }
  }

  return (
    <Dialog open={isOpen} onClose={handleClose} className="max-w-md mx-4">
      <DialogHeader>
        <DialogTitle>Subir factura</DialogTitle>
      </DialogHeader>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => e.key === "Enter" && handleClick()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
          dragOver
            ? "border-primary bg-primary/10"
            : "border-outline-variant hover:border-primary hover:bg-primary/5",
        ].join(" ")}
      >
        {selectedFile ? (
          <>
            {preview ? (
              <img
                src={preview}
                alt="Vista previa"
                className="max-h-48 object-contain rounded-lg mt-4 mx-auto"
              />
            ) : (
              <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-3 block">
                picture_as_pdf
              </span>
            )}
            <p className="text-sm text-on-surface-variant truncate mt-2">{selectedFile.name}</p>
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-3 block">
              upload_file
            </span>
            <p className="font-body text-on-surface-variant">Arrastra tu factura aquí</p>
            <p className="text-sm text-on-surface-variant/60">o haz clic para seleccionar</p>
            <p className="text-xs text-on-surface-variant/40 mt-2">JPEG · PNG · WebP · PDF</p>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {error && (
        <p className="mt-3 text-sm text-error">{error}</p>
      )}

      <DialogFooter className="mt-6 flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={handleClose}
          disabled={isUploading}
          className="px-5 py-2.5 rounded-full text-sm font-label font-medium text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!selectedFile || isUploading}
          className="flex items-center justify-center gap-2 bg-primary text-on-primary rounded-full px-6 py-3 font-label font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isUploading ? (
            <>
              <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
              Analizando con IA...
            </>
          ) : (
            "Analizar factura"
          )}
        </button>
      </DialogFooter>
    </Dialog>
  )
}
