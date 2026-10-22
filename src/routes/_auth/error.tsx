import { createFileRoute } from "@tanstack/react-router"
import { Check, Copy, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { z } from "zod"
import { AuthHeader } from "@/components/auth-header"
import { Button } from "@/components/ui/button"
import { env } from "@/env"
import { useI18n } from "@/i18n"
import { NON_REDIRECTABLE_OAUTH_ERRORS } from "@/lib/errors"

/**
 * Non-redirectable OAuth errors (RFC 6749 4.1.2.1). Never shows the redirect URI and never
 * navigates to the client.
 */
export const Route = createFileRoute("/_auth/error")({
  validateSearch: z.object({
    code: z.enum(NON_REDIRECTABLE_OAUTH_ERRORS).optional().catch(undefined),
    ref: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,64}$/)
      .optional()
      .catch(undefined),
  }),
  component: OAuthErrorPage,
})

function OAuthErrorPage() {
  const { code, ref } = Route.useSearch()
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const copy = code ?? "generic"
  return (
    <>
      <AuthHeader
        icon={
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-info-bg">
            <TriangleAlert className="size-5" aria-hidden />
          </span>
        }
        title={t(`auth.error.${copy}.title`)}
        lead={t(`auth.error.${copy}.body`)}
      />
      {ref ? (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl bg-surface-muted px-4 py-3 text-sm ring-1 ring-line">
          <span>
            {t("common.reference")}: <code className="font-mono break-all">{ref}</code>
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={copied ? t("common.copied") : t("common.copyReference")}
            onClick={() => {
              void navigator.clipboard?.writeText(ref).then(() => setCopied(true))
            }}
          >
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          </Button>
        </div>
      ) : null}
      <Button asChild block>
        <a href={env.wwwUrl}>{t("common.goHome")}</a>
      </Button>
    </>
  )
}
