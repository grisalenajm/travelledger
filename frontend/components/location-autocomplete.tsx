"use client"

import { useState, useRef, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

export interface PlaceResult {
  name: string
  display: string
  lat: number
  lng: number
}

interface Props {
  value: string
  onChange: (value: string) => void
  onSelect?: (place: PlaceResult) => void
  placeholder?: string
  type?: "city" | "business"
  className?: string
}

export function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  type = "city",
  className,
}: Props) {
  const [query, setQuery] = useState(value)
  const [debouncedQuery, setDebouncedQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Debounce: esperar 400ms tras dejar de escribir antes de buscar
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400)
    return () => clearTimeout(timer)
  }, [query])

  // Sincronizar value externo (ej: reset del formulario)
  useEffect(() => {
    setQuery(value)
  }, [value])

  // Cerrar al clicar fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["places", type, debouncedQuery],
    queryFn: () =>
      api.get<PlaceResult[]>(
        `/api/proxy/places/search?q=${encodeURIComponent(debouncedQuery)}&type=${type}`
      ),
    enabled: debouncedQuery.length >= 2,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder={placeholder ?? (type === "business" ? "Restaurante, tienda..." : "Ciudad, pueblo...")}
          className={cn(className)}
          autoComplete="off"
        />
        {isFetching && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant animate-spin leading-none">
            sync
          </span>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl bg-surface-container-lowest shadow-[0_8px_32px_rgba(26,28,30,0.12)] border border-outline-variant/15 overflow-hidden max-h-60 overflow-y-auto">
          {results.map((place, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => {
                setQuery(place.name)
                onChange(place.name)
                onSelect?.(place)
                setOpen(false)
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-surface-container transition-colors border-b border-outline-variant/10 last:border-0 min-h-[44px]"
            >
              <p className="text-sm font-medium text-on-surface">{place.name}</p>
              <p className="text-xs text-on-surface-variant truncate mt-0.5">{place.display}</p>
            </button>
          ))}
        </div>
      )}

      {open && debouncedQuery.length >= 2 && !isFetching && results.length === 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl bg-surface-container-lowest shadow-[0_8px_32px_rgba(26,28,30,0.12)] border border-outline-variant/15 px-4 py-3">
          <p className="text-xs text-on-surface-variant">Sin resultados para &quot;{debouncedQuery}&quot;</p>
        </div>
      )}
    </div>
  )
}
