"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"

import { useNotificationCount } from "@/hooks/use-notifications"
import { useIsGuest } from "@/hooks/use-is-guest"
import { useT } from "@/lib/i18n"
import { LanguageSelector } from "@/components/language-selector"

const NAV_LINKS = [
  { href: "/trips", icon: "flight", key: "nav.trips" },
  { href: "/stats", icon: "bar_chart", key: "nav.stats" },
  { href: "/legs/pending", icon: "move_to_inbox", key: "nav.pending" },
]

/** Título de la página para la TopBar móvil, derivado del pathname */
function getMobileTitle(pathname: string, t: (key: string) => string): string {
  if (pathname === "/") return t("nav.home")
  if (pathname === "/trips") return t("trips.title")
  if (pathname === "/trips/new") return t("nav.new_trip")
  if (pathname.includes("/itinerary")) return t("nav.itinerary")
  if (pathname.includes("/map")) return t("nav.map")
  if (pathname.includes("/stats") && pathname !== "/stats") return t("nav.stats")
  if (pathname.startsWith("/trips/") && pathname.includes("/expenses/")) return t("nav.expense")
  if (pathname.startsWith("/trips/") && pathname.includes("/edit")) return t("nav.edit_trip")
  if (pathname.startsWith("/trips/")) return t("nav.trip")
  if (pathname === "/stats") return t("nav.stats")
  if (pathname.startsWith("/settings/profile")) return t("settings.profile")
  if (pathname.startsWith("/settings/payment-methods")) return t("nav.payment_methods")
  if (pathname.startsWith("/settings/cards")) return t("nav.cards")
  if (pathname.startsWith("/settings/users")) return t("settings.users")
  if (pathname.startsWith("/settings")) return t("settings.title")
  if (pathname === "/notifications") return t("nav.notifications")
  if (pathname.startsWith("/legs/pending")) return t("nav.pending")
  if (pathname.startsWith("/expenses/scan")) return t("nav.scan")
  return "Ledger"
}

export function Navbar() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const { data: notifCount } = useNotificationCount()
  const isGuest = useIsGuest()
  const t = useT()
  const unread = notifCount?.unread ?? 0

  // Guard per BEST_PRACTICES.md — sin esto → bucle de re-renders en móvil
  if (status === "loading") return null
  if (!session) return null

  const initial = session.user?.name?.[0]?.toUpperCase() ?? "?"

  const handleLogout = async () => {
    try {
      await fetch("/api/proxy/auth/logout", { method: "POST" })
    } catch {
      // ignore — proceed with signOut regardless
    }
    signOut({ callbackUrl: "/login" })
  }

  return (
    <header className="sticky top-0 z-40 border-b border-outline-variant bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-2xl px-4 h-14 flex items-center justify-between gap-4">

        {/* Logo — solo desktop */}
        <Link
          href="/"
          className="hidden md:block font-headline font-extrabold text-lg text-primary tracking-tight"
        >
          Ledger
        </Link>

        {/* Título dinámico — solo móvil */}
        <span className="md:hidden font-headline font-bold text-lg text-primary tracking-tight">
          {getMobileTitle(pathname, t)}
        </span>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, icon, key }) => (
            <Link
              key={href}
              href={href}
              title={t(key)}
              className={[
                "p-1.5 rounded-lg transition-colors",
                pathname.startsWith(href)
                  ? "bg-primary/10 text-primary"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
              ].join(" ")}
            >
              <span className="material-symbols-outlined text-xl">{icon}</span>
            </Link>
          ))}
        </nav>

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/notifications"
            className={[
              "relative p-1.5 rounded-lg transition-colors",
              pathname.startsWith("/notifications")
                ? "bg-primary/10 text-primary"
                : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
            ].join(" ")}
            title={t("nav.notifications")}
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <LanguageSelector />
          {!isGuest && (
            <Link
              href="/settings"
              className={[
                "h-8 w-8 rounded-full bg-primary/15 text-primary font-headline font-bold text-sm flex items-center justify-center transition-colors hover:bg-primary/25",
                pathname.startsWith("/settings") ? "ring-2 ring-primary ring-offset-1" : "",
              ].join(" ")}
              title={session.user?.name ?? t("settings.profile")}
            >
              {initial}
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
            title={t("nav.logout")}
          >
            <span className="material-symbols-outlined text-xl">logout</span>
          </button>
        </div>

        {/* Mobile right side: notifications badge + avatar */}
        <div className="flex md:hidden items-center gap-1">
          <LanguageSelector />
          <Link
            href="/notifications"
            className="relative p-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            title={t("nav.notifications")}
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
            {unread > 0 && (
              <span className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          {!isGuest && (
            <Link
              href="/settings"
              className={[
                "h-8 w-8 rounded-full bg-primary/15 text-primary font-headline font-bold text-sm flex items-center justify-center transition-colors hover:bg-primary/25 min-h-[44px] min-w-[44px]",
                pathname.startsWith("/settings") ? "ring-2 ring-primary ring-offset-1" : "",
              ].join(" ")}
              title={session.user?.name ?? t("settings.profile")}
            >
              {initial}
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            title={t("nav.logout")}
          >
            <span className="material-symbols-outlined text-xl">logout</span>
          </button>
        </div>
      </div>
    </header>
  )
}
