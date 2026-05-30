"use client"

import { useState, useEffect } from "react"
import { useAirlineSearch } from "@/hooks/use-airlines"
import { AirlineLogo } from "@/components/airline-logo"

interface Airline {
  iata: string
  name: string
  country: string
}

interface AirlineAutocompleteProps {
  value: string
  onChange: (value: string, iata?: string) => void
  className?: string
  placeholder?: string
}

export function AirlineAutocomplete({
  value,
  onChange,
  className,
  placeholder = "Ej: Iberia, IB…",
}: AirlineAutocompleteProps) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Airline | null>(null)
  const { results, isLoading } = useAirlineSearch(open ? query : "")

  // Inicializar selected si el componente recibe un value ya rellenado (ej: editar un leg)
  useEffect(() => {
    if (value && !selected) {
      fetch(`/api/proxy/airlines/search?q=${encodeURIComponent(value)}`)
        .then((r) => r.json())
        .then((results: Airline[]) => {
          const match = results.find((a) => a.name === value)
          if (match) setSelected(match)
        })
        .catch(() => {
          // Sin logo si falla la búsqueda
        })
    }
    // Solo al montar o cuando cambia value desde fuera
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    onChange(val, undefined)
    setOpen(true)
    // Limpiar selección si el usuario edita manualmente
    if (selected && val !== selected.name) {
      setSelected(null)
    }
  }

  const handleSelect = (airline: Airline) => {
    setQuery(airline.name)
    onChange(airline.name, airline.iata)
    setSelected(airline)
    setOpen(false)
  }

  const handleBlur = () => {
    // Delay para permitir que onMouseDown del botón se dispare primero
    setTimeout(() => setOpen(false), 150)
  }

  return (
    <div className="relative">
      {/* Wrapper con logo inline cuando hay aerolínea seleccionada */}
      <div
        className={
          selected
            ? "flex items-center gap-2 border-b-2 border-[#bfc8cd] focus-within:border-[#004d64] transition-colors py-2"
            : undefined
        }
      >
        {selected && (
          <AirlineLogo iata={selected.iata} name={selected.name} size={20} />
        )}
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={
            selected
              ? "flex-1 bg-transparent text-sm outline-none"
              : className
          }
          autoComplete="off"
        />
      </div>

      {open && (results.length > 0 || isLoading) && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-surface rounded-xl shadow-[0_8px_32px_rgba(26,28,30,0.15)] border border-outline-variant/30 overflow-hidden max-h-60 overflow-y-auto">
          {isLoading && (
            <div className="px-4 py-3 text-sm text-on-surface-variant">Buscando…</div>
          )}
          {results.map((airline) => (
            <button
              key={airline.iata}
              type="button"
              onMouseDown={() => handleSelect(airline)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container transition-colors min-h-[44px] text-left"
            >
              <AirlineLogo iata={airline.iata} name={airline.name} size={24} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-on-surface truncate">{airline.name}</p>
                <p className="text-xs text-on-surface-variant">
                  {airline.iata} · {airline.country}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
