"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useT } from "@/lib/i18n"

// ─── Tabs (keys de traducción) ─────────────────────────────────────────────

const LEFT_TABS = [
  { href: "/", icon: "home", key: "nav.home" },
  { href: "/trips", icon: "luggage", key: "nav.trips" },
]
// Ajustes eliminado del bottom nav — accesible desde el avatar en TopBar
const RIGHT_TABS = [
  { href: "/stats", icon: "bar_chart", key: "nav.stats" },
]

function isTabActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname.startsWith(href)
}

// ─── BottomNav ─────────────────────────────────────────────────────────────

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, status } = useSession()
  const [scanOpen, setScanOpen] = useState(false)
  const t = useT()

  // Guard — per BEST_PRACTICES.md: sin guard → bucle en móvil
  if (status === "loading") return null
  if (!session) return null

  return (
    <>
      {/* ── Barra inferior — solo móvil ─────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 w-full md:hidden z-50
                   bg-surface/80 backdrop-blur-xl
                   shadow-[0_-8px_32px_rgba(26,28,30,0.06)]
                   border-t border-outline-variant/20"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 12px)" }}
        aria-label="Navegación principal"
      >
        <div className="flex items-center justify-around px-2 pt-1.5 pb-0.5">

          {/* Tabs izquierdos */}
          {LEFT_TABS.map(({ href, icon, key }) => {
            const active = isTabActive(href, pathname)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex flex-col items-center justify-center min-h-[44px] min-w-[44px] gap-1 transition-colors",
                  active ? "text-primary" : "text-on-surface-variant hover:text-primary",
                ].join(" ")}
              >
                <span
                  className="material-symbols-outlined text-xl"
                  style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {icon}
                </span>
                <span className="text-[11px] font-medium">{t(key)}</span>
              </Link>
            )
          })}

          {/* Tab central — Escanear */}
          <button
            type="button"
            onClick={() => setScanOpen(true)}
            className="flex flex-col items-center text-primary min-h-[44px] min-w-[44px] justify-center cursor-pointer"
            aria-label={t("nav.scan")}
          >
            <span
              className="material-symbols-outlined text-[28px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              document_scanner
            </span>
            <span className="text-[11px] font-medium mt-1">{t("nav.scan")}</span>
          </button>

          {/* Tabs derechos */}
          {RIGHT_TABS.map(({ href, icon, key }) => {
            const active = isTabActive(href, pathname)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex flex-col items-center justify-center min-h-[44px] min-w-[44px] gap-1 transition-colors",
                  active ? "text-primary" : "text-on-surface-variant hover:text-primary",
                ].join(" ")}
              >
                <span
                  className="material-symbols-outlined text-xl"
                  style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {icon}
                </span>
                <span className="text-[11px] font-medium">{t(key)}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* ── Scan Sheet ──────────────────────────────────────── */}
      {scanOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/40 z-[60] md:hidden"
            onClick={() => setScanOpen(false)}
            aria-hidden="true"
          />

          {/* Sheet */}
          <div
            className="fixed bottom-0 left-0 w-full z-[70] md:hidden
                       bg-surface rounded-t-[16px]
                       shadow-[0_-8px_32px_rgba(26,28,30,0.12)]
                       px-6 pt-4"
            style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
            role="dialog"
            aria-modal="true"
            aria-label="Añadir gasto"
          >
            {/* Handle */}
            <div className="w-10 h-1 bg-outline-variant rounded-full mx-auto mb-5" />

            <p className="font-headline font-bold text-base text-on-surface mb-4">
              {t("scan.title")}
            </p>

            {/* Escanear recibo — Flujo B (OCR) */}
            <button
              type="button"
              onClick={() => {
                setScanOpen(false)
                router.push("/expenses/scan")
              }}
              className="w-full flex items-center gap-4 p-4 rounded-xl
                         bg-primary text-on-primary min-h-[56px]
                         transition-opacity active:opacity-80"
            >
              <span
                className="material-symbols-outlined text-xl flex-shrink-0"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                add_a_photo
              </span>
              <div className="text-left">
                <p className="font-bold text-sm">{t("scan.receipt")}</p>
                <p className="text-xs opacity-80">{t("scan.receipt_sub")}</p>
              </div>
            </button>

            {/* Entrada manual — Flujo A */}
            <button
              type="button"
              onClick={() => {
                setScanOpen(false)
                router.push("/trips")
              }}
              className="w-full flex items-center gap-4 p-4 rounded-xl
                         bg-surface-container-low text-on-surface min-h-[56px] mt-3
                         transition-opacity active:opacity-80"
            >
              <span className="material-symbols-outlined text-xl text-primary flex-shrink-0">
                edit_note
              </span>
              <div className="text-left">
                <p className="font-bold text-sm">{t("scan.manual")}</p>
                <p className="text-xs text-on-surface-variant">{t("scan.manual_sub")}</p>
              </div>
            </button>
          </div>
        </>
      )}
    </>
  )
}
