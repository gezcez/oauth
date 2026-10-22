import { useI18n } from "@/i18n"
import { isServerError, toGezcezError } from "@/lib/errors"
import { useErrorMessage } from "@/lib/use-api-error"
import { env } from "@/env"
import { Alert } from "./ui/alert"
import type { ReactNode } from "react"

/** Summary alert above or below a form; shows the support reference for server-side failures. */
export function FormError({
  error,
  action,
  className,
}: {
  error: unknown
  action?: ReactNode
  className?: string
}) {
  const { t } = useI18n()
  const message = useErrorMessage()
  if (!error) return null
  const err = toGezcezError(error)
  const server = isServerError(err)
  return (
    <Alert tone="error" action={action} className={className}>
      <span>{message(err)}</span>
      {server ? (
        <span className="mt-1 block text-xs opacity-80">
          {err.reference ? (
            <>
              {t("common.reference")}: <code className="font-mono">{err.reference}</code>
              {" · "}
            </>
          ) : null}
          <a href={env.statusUrl} className="underline underline-offset-2" target="_blank" rel="noreferrer">
            {t("common.status")}
          </a>
        </span>
      ) : null}
    </Alert>
  )
}
