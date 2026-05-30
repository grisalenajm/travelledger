"use client"

import { useSession } from "next-auth/react"
import { useT } from "@/lib/i18n"

export function GuestBanner() {
  const { data: session, status } = useSession()
  const t = useT()

  // CRÍTICO: no renderizar nada hasta que la sesión esté resuelta
  if (status === "loading") return null
  if (!session) return null
  if (session.user?.role !== "guest") return null

  return (
    <div className="w-full bg-surface-container text-on-surface-variant text-xs font-label font-medium text-center py-1.5 px-4 border-b border-outline-variant/15">
      <span className="material-symbols-outlined text-xs align-middle mr-1">visibility</span>
      {t("guest.banner")}
    </div>
  )
}
