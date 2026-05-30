import { useState, useEffect, useRef } from "react"

export interface HotelResult {
  name: string
  display: string
  lat: number
  lng: number
}

export function useHotelSearch(query: string) {
  const [results, setResults] = useState<HotelResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([])
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/proxy/places/search?q=${encodeURIComponent(query)}&type=business`)
        if (!res.ok) {
          setResults([])
          return
        }
        const data: HotelResult[] = await res.json()
        setResults(data)
      } catch {
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, 400)

    return () => clearTimeout(debounceRef.current)
  }, [query])

  return { results, isLoading }
}
