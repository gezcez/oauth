import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
import { authRequestQuery } from "@/api/queries"
import { useI18n } from "@/i18n"
import { isGezcezError, isOAuthPageError } from "@/lib/errors"
import { fromUiLocales } from "@/lib/locale"

/**
 * Snapshot of the server-side auth request (`?req=ar_...`): client display info, scopes,
 * login_hint, ui_locales. A gone or expired request shows the error page. ui_locales sets the
 * UI language for this visit without overriding the stored preference.
 */
export function useAuthRequest(req: string | undefined) {
  const navigate = useNavigate()
  const { locale, setLocale } = useI18n()
  const q = useQuery({ ...authRequestQuery(req ?? ""), enabled: Boolean(req) })
  const applied = useRef(false)

  useEffect(() => {
    const err = q.error
    if (err && isGezcezError(err) && isOAuthPageError(err.code)) {
      void navigate({ to: "/error", search: { code: err.code, ref: err.reference }, replace: true })
    }
  }, [q.error, navigate])

  useEffect(() => {
    if (applied.current || !q.data) return
    applied.current = true
    const l = fromUiLocales(q.data.ui_locales)
    if (l && l !== locale) setLocale(l, { persist: false })
  }, [q.data, locale, setLocale])

  return q
}
