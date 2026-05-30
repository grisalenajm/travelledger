let _cache: Record<string, string> | null = null

export async function getIataByName(name: string): Promise<string | null> {
  if (!_cache) {
    try {
      const res = await fetch("/airlines-lookup.json")
      if (!res.ok) return null
      _cache = (await res.json()) as Record<string, string>
    } catch {
      return null
    }
  }
  return _cache[name] ?? null
}
