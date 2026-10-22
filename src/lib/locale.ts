import type { Locale } from "@/i18n/types"

const STORAGE_KEY = "gz.locale"

export function normaliseLocale(value: string | null | undefined): Locale | null {
  if (!value) return null
  const first =
    value
      .trim()
      .split(/[\s,]+/)[0]
      ?.toLowerCase() ?? ""
  if (first.startsWith("tr")) return "tr"
  if (first.startsWith("en")) return "en"
  return null
}

/** ui_locales may list several, space separated, in order of preference. */
export function fromUiLocales(uiLocales: string | null | undefined): Locale | null {
  if (!uiLocales) return null
  for (const part of uiLocales.split(/\s+/)) {
    const l = normaliseLocale(part)
    if (l) return l
  }
  return null
}

export function storedLocale(): Locale | null {
  try {
    return normaliseLocale(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

export function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // private mode: ignore
  }
}

export function navigatorLocale(): Locale | null {
  if (typeof navigator === "undefined") return null
  for (const l of navigator.languages ?? [navigator.language]) {
    const n = normaliseLocale(l)
    if (n) return n
  }
  return null
}

/** Order from oauth.md 7.2: ui_locales > account > stored > navigator > en. */
export function detectLocale(opts: { uiLocales?: string | null; account?: string | null } = {}): Locale {
  return (
    fromUiLocales(opts.uiLocales) ??
    normaliseLocale(opts.account) ??
    storedLocale() ??
    navigatorLocale() ??
    "en"
  )
}

export function initialLocale(): Locale {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null
  return detectLocale({ uiLocales: params?.get("ui_locales") })
}
