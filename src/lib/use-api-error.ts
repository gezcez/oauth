import { useNavigate, useRouterState } from "@tanstack/react-router"
import { useCallback } from "react"
import { toast } from "@/components/ui/toaster"
import { useI18n, type I18n } from "@/i18n"
import type { TKey } from "@/i18n/types"
import { errorBehaviour, isOAuthPageError, toGezcezError, type GezcezError } from "./errors"
import { safeInternalPath } from "./navigation"

/** Human message for an error, with retry time and attempts interpolated. */
export function errorMessage(i18n: Pick<I18n, "t" | "tp" | "formatDuration">, err: GezcezError): string {
  const { t, tp, formatDuration } = i18n
  if (err.code === "RATE_LIMITED") {
    const s = Number(err.details.retry_after)
    return Number.isFinite(s) && s > 0
      ? t("errors.RATE_LIMITED", { time: formatDuration(s) })
      : t("errors.rateLimitedNoTime")
  }
  const base = t(`errors.${err.code}` as TKey)
  if (err.code === "AUTH_CODE_INVALID" && typeof err.details.attempts_left === "number") {
    return `${base} ${tp("errors.attemptsLeft", err.details.attempts_left)}`
  }
  return base
}

export function useErrorMessage() {
  const i18n = useI18n()
  return useCallback((e: unknown) => errorMessage(i18n, toGezcezError(e)), [i18n])
}

/**
 * For errors that are not handled inline: session gone -> /signin?return=, step-up -> /reauth?return=,
 * non-redirectable OAuth error -> /error, everything else -> toast with the support reference.
 * Returns true when it handled the error.
 */
export function useHandleApiError() {
  const navigate = useNavigate()
  const i18n = useI18n()
  const href = useRouterState({ select: (s) => s.location.href })
  return useCallback(
    (e: unknown, opts: { returnTo?: string; toastInline?: boolean } = {}): boolean => {
      const err = toGezcezError(e)
      const behaviour = errorBehaviour[err.code]
      const returnTo = safeInternalPath(opts.returnTo ?? href)
      if (behaviour === "signin") {
        toast(i18n.t("auth.signin.sessionExpired"))
        void navigate({ to: "/signin", search: { return: returnTo } })
        return true
      }
      if (behaviour === "reauth") {
        void navigate({ to: "/reauth", search: { return: returnTo } })
        return true
      }
      if (behaviour === "page" && isOAuthPageError(err.code)) {
        void navigate({ to: "/error", search: { code: err.code, ref: err.reference }, replace: true })
        return true
      }
      if (behaviour === "toast" || opts.toastInline) {
        toast.error(errorMessage(i18n, err), {
          description: err.reference ? `${i18n.t("common.reference")}: ${err.reference}` : undefined,
        })
        return true
      }
      return false
    },
    [navigate, i18n, href],
  )
}
