"use client"

import { useEffect, useRef, useState } from "react"
import { api } from "@/lib/api"

interface AirportResult {
  iata: string
  name: string
  city: string
  country: string
  lat: number
  lng: number
}

interface IataInputProps {
  id?: string
  value?: string
  onChange: (value: string) => void
  onSelectAirport?: (airport: AirportResult) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function IataInput({
  id,
  value,
  onChange,
  onSelectAirport,
  placeholder = "MAD",
  className,
  disabled,
}: IataInputProps) {
  const [inputText, setInputText] = useState(value ?? "")
  const [results, setResults] = useState<AirportResult[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  // True when the current inputText represents a confirmed IATA selection
  const [isSelected, setIsSelected] = useState(!!value)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync on form reset (value prop changes from parent)
  useEffect(() => {
    const displayIata = inputText.split(" ·")[0].trim()
    if (displayIata !== (value ?? "")) {
      setInputText(value ?? "")
      setIsSelected(!!value)
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchResults = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) {
      setResults([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.get<AirportResult[]>(
          `/api/proxy/airports/search?q=${encodeURIComponent(q)}`
        )
        setResults(data)
        setOpen(data.length > 0)
        setActiveIndex(-1)
      } catch {
        setResults([])
        setOpen(false)
      }
    }, 200)
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setInputText(v)
    setIsSelected(false)
    // Don't propagate raw text — only IATA codes confirmed via dropdown selection
    fetchResults(v)
  }

  const select = (airport: AirportResult) => {
    const display = `${airport.iata} · ${airport.city || airport.name}`
    setInputText(display)
    setIsSelected(true)
    onChange(airport.iata)
    if (onSelectAirport) onSelectAirport(airport)
    setOpen(false)
    setResults([])
  }

  const handleBlur = () => {
    // Defer so onMouseDown on a list item fires first
    setTimeout(() => {
      setOpen(false)
      if (isSelected) return

      // Accept bare 3-letter IATA typed directly (e.g. "MAD" without dropdown)
      const q = inputText.trim().toUpperCase()
      if (/^[A-Z]{3}$/.test(q)) {
        setInputText(q)
        setIsSelected(true)
        onChange(q)
        return
      }

      // Invalid free text — revert to last confirmed value (or empty)
      setInputText(value ?? "")
    }, 150)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault()
      select(results[activeIndex])
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        value={inputText}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-lg border border-outline-variant bg-surface shadow-md"
        >
          {results.map((a, i) => (
            <li
              key={a.iata}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={() => select(a)}
              className={[
                "flex flex-col px-3 py-2 cursor-pointer select-none",
                i === activeIndex ? "bg-primary/10" : "hover:bg-surface-container",
              ].join(" ")}
            >
              <span className="font-bold text-sm text-on-surface">{a.iata}</span>
              <span className="text-xs text-on-surface-variant truncate">
                {a.city || a.name} · {a.country}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
