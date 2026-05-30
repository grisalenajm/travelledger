"use client"

import Link from "next/link"
import { useMarkRead, useNotifications } from "@/hooks/use-notifications"

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "ahora mismo"
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `hace ${days}d`
}

export default function NotificationsPage() {
  const { data: notifications = [], isLoading } = useNotifications()
  const { mutate: markRead, isPending } = useMarkRead()

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-on-surface-variant text-sm">Cargando…</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-4">
      <h1 className="font-headline font-bold text-2xl">Notificaciones</h1>

      {notifications.length === 0 ? (
        <div className="rounded-xl border border-outline-variant p-8 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant">
            notifications_none
          </span>
          <p className="mt-2 text-on-surface-variant text-sm">No hay notificaciones</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={[
                "flex items-start gap-3 rounded-xl border p-4 transition-colors",
                n.read
                  ? "border-outline-variant bg-surface-container/40 opacity-60"
                  : "border-primary/30 bg-primary/5",
              ].join(" ")}
            >
              <span
                className={[
                  "material-symbols-outlined mt-0.5 text-xl shrink-0",
                  n.read ? "text-on-surface-variant" : "text-primary",
                ].join(" ")}
              >
                {(n.type === "email_import" || n.type === "email_imap")
                  ? "flight_takeoff"
                  : "info"}
              </span>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-on-surface">{n.title}</p>
                {n.message && (
                  <p className="text-xs text-on-surface-variant mt-0.5 truncate">{n.message}</p>
                )}
                <p className="text-xs text-on-surface-variant/70 mt-1">
                  {relativeTime(n.created_at)}
                </p>
                {(n.type === "email_import" || n.type === "email_imap") && (
                  <Link
                    href="/legs/pending"
                    className="text-xs text-primary hover:text-primary/70 transition-colors mt-1 inline-block"
                  >
                    Ver tramos pendientes →
                  </Link>
                )}
              </div>

              {!n.read && (
                <button
                  onClick={() => markRead(n.id)}
                  disabled={isPending}
                  className="shrink-0 text-xs text-primary hover:text-primary/70 transition-colors disabled:opacity-50"
                >
                  Leída
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
