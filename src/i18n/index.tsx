import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { initialLocale, storeLocale } from "@/lib/locale"
import { translate, translatePlural } from "./translate"
import type { Locale, PluralKey, TKey, Vars } from "./types"

export type { Locale, TKey, PluralKey } from "./types"

export interface I18n {
  locale: Locale
  setLocale: (l: Locale, opts?: { persist?: boolean }) => void
  t: (key: TKey, vars?: Vars) => string
  tp: (key: PluralKey, count: number, vars?: Vars) => string
  formatDate: (iso: string | Date, style?: "long" | "short" | "datetime") => string
  formatRelative: (iso: string | Date) => string
  formatDuration: (seconds: number) => string
}

const I18nContext = createContext<I18n | null>(null)

export function createI18n(locale: Locale, setLocale: I18n["setLocale"] = () => {}): I18n {
  const t = (key: TKey, vars?: Vars) => translate(locale, key, vars)
  const tp = (key: PluralKey, count: number, vars?: Vars) => translatePlural(locale, key, count, vars)
  const intlLocale = locale === "tr" ? "tr-TR" : "en-GB"
  const formatDate: I18n["formatDate"] = (iso, style = "long") => {
    const d = typeof iso === "string" ? new Date(iso) : iso
    if (Number.isNaN(d.getTime())) return ""
    if (style === "datetime")
      return new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeStyle: "short" }).format(d)
    return new Intl.DateTimeFormat(
      intlLocale,
      style === "long"
        ? { day: "numeric", month: "long", year: "numeric" }
        : { day: "numeric", month: "short" },
    ).format(d)
  }
  const formatRelative: I18n["formatRelative"] = (iso) => {
    const d = typeof iso === "string" ? new Date(iso) : iso
    const diff = (d.getTime() - Date.now()) / 1000
    const abs = Math.abs(diff)
    const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto", style: "short" })
    if (abs < 45) return translate(locale, "common.relative.justNow")
    if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute")
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour")
    if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day")
    return formatDate(d, "long")
  }
  const formatDuration: I18n["formatDuration"] = (seconds) => {
    const s = Math.max(0, Math.ceil(seconds))
    if (s >= 120) {
      const minutes = Math.ceil(s / 60)
      return new Intl.NumberFormat(intlLocale, { style: "unit", unit: "minute", unitDisplay: "long" }).format(
        minutes,
      )
    }
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${String(r).padStart(2, "0")}`
  }
  return { locale, setLocale, t, tp, formatDate, formatRelative, formatDuration }
}

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => initial ?? initialLocale())
  const setLocale = useCallback<I18n["setLocale"]>((l, opts) => {
    setLocaleState(l)
    if (opts?.persist !== false) storeLocale(l)
  }, [])
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  const value = useMemo(() => createI18n(locale, setLocale), [locale, setLocale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n outside I18nProvider")
  return ctx
}
