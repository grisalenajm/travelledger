import { useState, useEffect, useRef } from "react"

export interface Airline {
  iata: string
  name: string
  country: string
  logo_url: string
}

export function useAirlineSearch(query: string) {
  const [results, setResults] = useState<Airline[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!query || query.length < 1) {
      setResults([])
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/proxy/airlines/search?q=${encodeURIComponent(query)}`)
        if (!res.ok) {
          setResults([])
          return
        }
        const data: Airline[] = await res.json()
        setResults(data)
      } catch {
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => clearTimeout(debounceRef.current)
  }, [query])

  return { results, isLoading }
}
