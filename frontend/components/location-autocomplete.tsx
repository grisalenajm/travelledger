"use client"

import { useState, useRef, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

export interface PlaceResult {
  name: string
  display_name: string
  lat: number
  lng: number
}

interface GeoSearchResult {
  place_id: number
  name: string
  display_name: string
  lat: number
  lon: number
  type?: string
  address?: Record<string, string>
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

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["geocoding-search", debouncedQuery],
    queryFn: () =>
      api.get<GeoSearchResult[]>(
        `/api/proxy/geocoding/search?q=${encodeURIComponent(debouncedQuery)}&limit=7`
      ),
    enabled: debouncedQuery.length >= 3,
    staleTime: 5 * 60 * 1000,
  })

  const handleSelect = (result: GeoSearchResult) => {
    setQuery(result.name)
    onChange(result.name)
    onSelect?.({
      name: result.name,
      display_name: result.display_name,
      lat: result.lat,
      lng: result.lon,
    })
    setOpen(false)
  }

  const getSubtitle = (result: GeoSearchResult) => {
    const full = result.display_name
    const name = result.name
    if (full.startsWith(name)) {
      return full.slice(name.length).replace(/^[, ]+/, "")
    }
    return full
  }

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
          onFocus={() => query.length >= 3 && setOpen(true)}
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
        <div
          className="absolute z-50 top-full mt-1 rounded-xl bg-surface-container-lowest shadow-[0_8px_32px_rgba(26,28,30,0.12)] border border-outline-variant/15 overflow-hidden max-h-72 overflow-y-auto"
          style={{ left: 0, minWidth: "min(520px, 90vw)" }}
        >
          {results.map((result) => (
            <button
              key={result.place_id}
              type="button"
              onMouseDown={() => handleSelect(result)}
              className="w-full text-left px-4 py-2.5 hover:bg-surface-container transition-colors border-b border-outline-variant/10 last:border-0 min-h-[52px] flex items-start gap-2"
            >
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant mt-0.5 shrink-0 leading-none">
                location_on
              </span>
              <div className="flex flex-col min-w-0">
                <p className="text-sm font-medium text-on-surface leading-tight">{result.name}</p>
                <p className="text-xs text-on-surface-variant leading-tight mt-0.5 line-clamp-2">
                  {getSubtitle(result)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && debouncedQuery.length >= 3 && !isFetching && results.length === 0 && (
        <div
          className="absolute z-50 top-full mt-1 rounded-xl bg-surface-container-lowest shadow-[0_8px_32px_rgba(26,28,30,0.12)] border border-outline-variant/15 px-4 py-3"
          style={{ left: 0, minWidth: "min(520px, 90vw)" }}
        >
          <p className="text-xs text-on-surface-variant">Sin resultados para &quot;{debouncedQuery}&quot;</p>
        </div>
      )}
    </div>
  )
}
