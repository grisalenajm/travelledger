"use client"

import { useState, useRef, useEffect } from "react"
import { useI18n, SUPPORTED, type Locale } from "@/lib/i18n"
import { useSession } from "next-auth/react"

// flagcdn.com — gratuito, sin API key, funciona en Linux (no depende de emoji del SO)
const LOCALE_FLAGS: Record<Locale, string> = {
  es: "https://flagcdn.com/w20/es.png",
  en: "https://flagcdn.com/w20/gb.png",
  fr: "https://flagcdn.com/w20/fr.png",
}

const LOCALE_NAMES: Record<Locale, string> = {
  es: "Español",
  en: "English",
  fr: "Français",
}

export function LanguageSelector() {
  const { status } = useSession()
  const { locale, setLocale } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Cerrar al clicar fuera — todos los hooks deben ir antes de cualquier return
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Guard loading — evita bucle en móvil
  if (status === "loading") return null

  return (
    <div ref={ref} className="relative">
      {/* Botón actual */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-2 py-1.5 rounded-full hover:bg-surface-container-high transition-colors"
      >
        <img
          src={LOCALE_FLAGS[locale]}
          alt={locale}
          className="w-5 h-auto rounded-sm"
        />
        <span className="material-symbols-outlined text-base leading-none text-on-surface-variant">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1 rounded-xl bg-surface-container-lowest shadow-[0_8px_32px_rgba(26,28,30,0.12)] border border-outline-variant/15 overflow-hidden z-50 min-w-[120px]">
          {SUPPORTED.map((l) => (
            <button
              key={l}
              onClick={() => {
                setLocale(l)
                setOpen(false)
              }}
              className={[
                "w-full flex items-center gap-2 px-4 py-2.5 text-sm font-label font-medium transition-colors",
                locale === l
                  ? "bg-primary/10 text-primary"
                  : "text-on-surface-variant hover:bg-surface-container",
              ].join(" ")}
            >
              <img
                src={LOCALE_FLAGS[l]}
                alt={l}
                className="w-5 h-auto rounded-sm"
              />
              <span>{LOCALE_NAMES[l]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
