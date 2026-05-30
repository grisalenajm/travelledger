"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react"
import es from "@/messages/es.json"
import en from "@/messages/en.json"
import fr from "@/messages/fr.json"

type Messages = typeof es
export type Locale = "es" | "en" | "fr"

const MESSAGES: Record<Locale, Messages> = { es, en, fr }
export const SUPPORTED: Locale[] = ["es", "en", "fr"]
const DEFAULT: Locale = "es"
const COOKIE = "NEXT_LOCALE"

function detectLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT
  // 1. Cookie
  const cookie = document.cookie
    .split(";")
    .find((c) => c.trim().startsWith(`${COOKIE}=`))
  if (cookie) {
    const val = cookie.split("=")[1]?.trim() as Locale
    if (SUPPORTED.includes(val)) return val
  }
  // 2. Accept-Language del navegador
  const lang = navigator.language?.slice(0, 2) as Locale
  if (SUPPORTED.includes(lang)) return lang
  return DEFAULT
}

function setLocaleCookie(locale: Locale) {
  const expires = new Date()
  expires.setDate(expires.getDate() + 30)
  document.cookie = `${COOKIE}=${locale};path=/;expires=${expires.toUTCString()};SameSite=Lax`
}

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextType>({
  locale: DEFAULT,
  setLocale: () => {},
  t: (key) => key,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT)

  // Detectar idioma al montar (cookie → browser language → default)
  useEffect(() => {
    setLocaleState(detectLocale())
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    setLocaleCookie(newLocale)
  }

  const t = (key: string): string => {
    const keys = key.split(".")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any = MESSAGES[locale]
    for (const k of keys) {
      value = value?.[k]
    }
    if (typeof value === "string") return value
    // Fallback a español
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fallback: any = MESSAGES[DEFAULT]
    for (const k of keys) {
      fallback = fallback?.[k]
    }
    return typeof fallback === "string" ? fallback : key
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

export function useT() {
  return useContext(I18nContext).t
}

export const LOCALE_LABELS: Record<Locale, string> = {
  es: "Español",
  en: "English",
  fr: "Français",
}
