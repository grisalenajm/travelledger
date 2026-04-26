"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"

const AUTH_PATHS = ["/login", "/register"]

export function Navbar() {
  const { data: session, status } = useSession()
  const pathname = usePathname()

  if (status !== "authenticated" || AUTH_PATHS.includes(pathname)) return null

  const initial =
    session.user?.name?.[0]?.toUpperCase() ??
    session.user?.email?.[0]?.toUpperCase() ??
    "?"

  return (
    <nav className="sticky top-0 z-50 border-b border-outline-variant bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 h-14">
        <Link href="/" className="font-headline text-lg font-bold text-primary">
          Ledger
        </Link>

        <div className="flex items-center gap-1">
          <Link
            href="/trips"
            className={[
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              pathname.startsWith("/trips")
                ? "text-primary bg-primary/10"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container",
            ].join(" ")}
          >
            Viajes
          </Link>
          <Link
            href="/settings/cards"
            className={[
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              pathname === "/settings/cards"
                ? "text-primary bg-primary/10"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container",
            ].join(" ")}
          >
            Tarjetas
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/settings/profile"
            className={[
              "flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-sm font-bold transition-opacity hover:opacity-90",
              pathname === "/settings/profile" ? "ring-2 ring-primary ring-offset-2" : "",
            ].join(" ")}
            title="Perfil"
          >
            {initial}
          </Link>
          <Button
            size="sm"
            variant="ghost"
            className="text-on-surface-variant"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <span className="material-symbols-outlined text-base leading-none mr-1">logout</span>
            Salir
          </Button>
        </div>
      </div>
    </nav>
  )
}
