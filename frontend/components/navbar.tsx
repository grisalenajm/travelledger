"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"

const NAV_LINKS = [
  { href: "/trips", label: "Viajes" },
  { href: "/settings/cards", label: "Tarjetas" },
]

export function Navbar() {
  const { data: session, status } = useSession()
  const pathname = usePathname()

  if (status !== "authenticated") return null

  const initial = session.user?.name?.[0]?.toUpperCase() ?? "?"

  return (
    <header className="sticky top-0 z-40 border-b border-outline-variant bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-2xl px-4 h-14 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="font-headline font-extrabold text-lg text-primary tracking-tight"
        >
          Ledger
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={[
                "px-3 py-1.5 rounded-lg text-sm font-label font-medium transition-colors",
                pathname.startsWith(href)
                  ? "bg-primary/10 text-primary"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
              ].join(" ")}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/settings/profile"
            className={[
              "h-8 w-8 rounded-full bg-primary/15 text-primary font-headline font-bold text-sm flex items-center justify-center transition-colors hover:bg-primary/25",
              pathname === "/settings/profile" ? "ring-2 ring-primary ring-offset-1" : "",
            ].join(" ")}
            title={session.user?.name ?? "Perfil"}
          >
            {initial}
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
            title="Cerrar sesión"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
          </button>
        </div>
      </div>
    </header>
  )
}
