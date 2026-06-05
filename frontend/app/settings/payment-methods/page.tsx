"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  usePaymentMethods,
  useCreatePaymentMethod,
  useDeletePaymentMethod,
} from "@/hooks/use-payment-methods"
import { Button } from "@/components/ui/button"

export default function PaymentMethodsPage() {
  const router = useRouter()
  const { data: methods, isLoading } = usePaymentMethods()
  const create = useCreatePaymentMethod()
  const remove = useDeletePaymentMethod()
  const [newName, setNewName] = useState("")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    await create.mutateAsync(name)
    setNewName("")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 bg-surface border-b border-outline-variant/20 flex items-center px-4 gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
          aria-label="Volver"
        >
          <span className="material-symbols-outlined text-[22px] leading-none">arrow_back</span>
        </button>
        <h1 className="flex-1 font-headline font-bold text-[15px] text-on-surface">
          Métodos de pago
        </h1>
      </header>

      <div className="mx-auto max-w-lg px-4 py-6 space-y-6">

        {/* Add new */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Nuevo método (ej: Revolut, AMEX…)"
            maxLength={20}
            className="flex-1 bg-transparent border-b border-outline py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none transition-colors"
          />
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!newName.trim() || create.isPending}
          >
            {create.isPending ? "…" : "Añadir"}
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 bg-surface-container-high rounded-xl" />
            ))}
          </div>
        ) : !methods?.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-3">
              payment
            </span>
            <p className="text-sm text-on-surface-variant">Sin métodos de pago</p>
          </div>
        ) : (
          <>
          {deleteError && (
            <p className="text-sm text-error bg-error/10 rounded-lg px-3 py-2 mb-2">{deleteError}</p>
          )}
          <ul className="space-y-2">
            {methods.map((pm) => (
              <li
                key={pm.id}
                className="flex items-center gap-3 rounded-xl bg-surface-container-lowest px-4 py-3 shadow-editorial"
              >
                <span className="flex-1 text-sm font-medium text-on-surface">{pm.name}</span>
                {confirmDeleteId === pm.id ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs text-on-surface-variant px-2 py-1 rounded hover:bg-surface-container"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setDeleteError(null)
                        try {
                          await remove.mutateAsync(pm.id)
                          setConfirmDeleteId(null)
                        } catch (err: unknown) {
                          const msg =
                            err instanceof Error
                              ? err.message
                              : "No se puede eliminar este método de pago."
                          setDeleteError(msg)
                          setConfirmDeleteId(null)
                        }
                      }}
                      disabled={remove.isPending}
                      className="text-xs text-white bg-error px-3 py-1 rounded-full disabled:opacity-50"
                    >
                      {remove.isPending ? "…" : "Eliminar"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(pm.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container hover:text-error transition-colors"
                    aria-label="Eliminar"
                  >
                    <span className="material-symbols-outlined text-[18px] leading-none">delete</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
          </>
        )}

      </div>
    </div>
  )
}
