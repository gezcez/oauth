import { useEffect, useRef } from "react"
import type { Locale } from "@/api/schema"
import { useI18n } from "@/i18n"

/** On the account pages the account's saved language wins over the stored and browser preference (oauth.md 7.2: ui_locales > account > stored > navigator). */
export function useAccountLocale(accountLocale: Locale, sessionId: string | undefined) {
  const { locale, setLocale } = useI18n()
  const applied = useRef<string | null>(null)
  useEffect(() => {
    if (!sessionId || applied.current === sessionId) return
    applied.current = sessionId
    if (accountLocale !== locale) setLocale(accountLocale, { persist: false })
  }, [accountLocale, sessionId, locale, setLocale])
}
