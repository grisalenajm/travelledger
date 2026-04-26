// URLs relativas → el proxy /api/proxy/[...path] añade auth y reenvía al backend
const API_BASE = ""

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {}
  try {
    const { getSession } = await import("next-auth/react")
    const session = await getSession()
    if (session?.accessToken) {
      return { Authorization: `Bearer ${session.accessToken}` }
    }
  } catch {
    // not in a browser context that supports next-auth
  }
  return {}
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const authHeaders = await getAuthHeaders()

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...(options.headers as Record<string, string>),
    },
  })

  if (res.status === 401 && typeof window !== "undefined") {
    const { signOut } = await import("next-auth/react")
    await signOut({ callbackUrl: "/login" })
    throw new ApiError(401, "Sesión expirada")
  }

  if (!res.ok) {
    throw new ApiError(res.status, await res.text())
  }

  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { method: "GET", ...init }),

  post: <T>(path: string, body: unknown, init?: RequestInit) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      ...init,
    }),

  put: <T>(path: string, body: unknown, init?: RequestInit) =>
    request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
      ...init,
    }),

  delete: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { method: "DELETE", ...init }),
}
