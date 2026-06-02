"use client"

import { useState } from "react"
import type { PaymentMethodItem } from "@/hooks/use-payment-methods"

interface PaymentMethodComboboxProps {
  value: string | null
  onChange: (id: string | null) => void
  methods: PaymentMethodItem[]
  onCreateNew: (name: string) => Promise<PaymentMethodItem>
  className?: string
}

export function PaymentMethodCombobox({
  value,
  onChange,
  methods,
  onCreateNew,
  className = "",
}: PaymentMethodComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)

  const selectedName = methods.find((m) => m.id === value)?.name

  const filtered = methods.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  )
  const exactMatch = methods.some(
    (m) => m.name.toLowerCase() === search.toLowerCase()
  )
  const showCreate = search.trim().length > 0 && !exactMatch

  const handleCreate = async () => {
    if (!search.trim() || creating) return
    setCreating(true)
    try {
      const created = await onCreateNew(search.trim())
      onChange(created.id)
      setSearch("")
      setOpen(false)
    } finally {
      setCreating(false)
    }
  }

  const handleBlur = () => {
    setTimeout(() => setOpen(false), 150)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={handleBlur}
        className={`w-full text-left ${className}`}
      >
        {selectedName ? (
          <span className="text-on-surface">{selectedName}</span>
        ) : (
          <span className="text-on-surface-variant/50">— Sin método de pago —</span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-surface rounded-xl shadow-[0_8px_32px_rgba(26,28,30,0.15)] border border-outline-variant/30 overflow-hidden">
          <div className="p-2 border-b border-outline-variant/20">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar o crear..."
              className="w-full bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none px-2 py-1"
            />
          </div>

          <div className="max-h-48 overflow-y-auto">
            {/* Opción limpiar selección */}
            <button
              type="button"
              onMouseDown={() => { onChange(null); setSearch(""); setOpen(false) }}
              className="w-full flex items-center px-3 py-2.5 text-sm text-on-surface-variant hover:bg-surface-container transition-colors text-left"
            >
              — Sin método de pago —
            </button>

            {filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                onMouseDown={() => { onChange(m.id); setSearch(""); setOpen(false) }}
                className={[
                  "w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface-container transition-colors text-left",
                  value === m.id ? "text-primary font-medium" : "text-on-surface",
                ].join(" ")}
              >
                {value === m.id && (
                  <span className="material-symbols-outlined text-[14px] leading-none shrink-0">check</span>
                )}
                <span>{m.name}</span>
              </button>
            ))}

            {showCreate && (
              <button
                type="button"
                onMouseDown={handleCreate}
                disabled={creating}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-primary font-medium hover:bg-primary/5 transition-colors text-left border-t border-outline-variant/20"
              >
                <span className="material-symbols-outlined text-[14px] leading-none">add</span>
                {creating ? "Creando…" : `Crear "${search.trim()}"`}
              </button>
            )}

            {filtered.length === 0 && !showCreate && (
              <p className="px-3 py-3 text-xs text-on-surface-variant">
                Sin métodos de pago. Escribe para crear uno.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
