"use client"

import { useState, useEffect } from "react"
import { useHotelSearch, type HotelResult } from "@/hooks/use-hotel-search"

interface HotelAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect: (hotel: HotelResult) => void
  placeholder?: string
  className?: string
}

export function HotelAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Nombre del hotel...",
  className,
}: HotelAutocompleteProps) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const { results, isLoading } = useHotelSearch(open ? query : "")

  // Sincronizar query si value cambia desde fuera (ej: editar leg existente)
  useEffect(() => {
    if (value !== query) {
      setQuery(value)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    onChange(val)
    setOpen(true)
  }

  const handleSelect = (hotel: HotelResult) => {
    setQuery(hotel.name)
    onChange(hotel.name)
    onSelect(hotel)
    setOpen(false)
  }

  const handleBlur = () => {
    // Delay para permitir que onMouseDown del botón se dispare primero
    setTimeout(() => setOpen(false), 150)
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        onFocus={() => query.length >= 2 && setOpen(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />

      {open && (results.length > 0 || isLoading) && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-surface rounded-xl shadow-[0_8px_32px_rgba(26,28,30,0.15)] border border-outline-variant/30 overflow-hidden max-h-60 overflow-y-auto">
          {isLoading && (
            <div className="px-4 py-3 text-sm text-on-surface-variant">Buscando…</div>
          )}
          {results.map((hotel, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => handleSelect(hotel)}
              className="w-full flex flex-col items-start px-4 py-2.5 hover:bg-surface-container transition-colors min-h-[44px] text-left border-b border-outline-variant/10 last:border-0"
            >
              <p className="text-sm font-medium text-on-surface truncate w-full">{hotel.name}</p>
              <p className="text-xs text-on-surface-variant truncate w-full mt-0.5">{hotel.display}</p>
            </button>
          ))}
        </div>
      )}

      {open && query.length >= 2 && !isLoading && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl bg-surface border border-outline-variant/30 shadow-[0_8px_32px_rgba(26,28,30,0.15)] px-4 py-3">
          <p className="text-xs text-on-surface-variant">Sin resultados para &quot;{query}&quot;</p>
        </div>
      )}
    </div>
  )
}
