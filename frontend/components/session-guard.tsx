"use client"

import { useSession, signOut } from "next-auth/react"
import { useEffect } from "react"

export function SessionGuard() {
  const { data: session, status } = useSession()

  useEffect(() => {
    // Espera a que la sesión esté resuelta antes de comprobar errores —
    // patrón de guard de loading aplicado por consistencia (ver BEST_PRACTICES Fix 35).
    if (status === "loading") return
    if (session?.error === "RefreshAccessTokenError") {
      signOut({ callbackUrl: "/login" })
    }
  }, [status, session?.error])

  return null
}
