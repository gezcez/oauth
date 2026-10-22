import { useMutation } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Mail } from "lucide-react"
import { AuthHeader } from "@/components/auth-header"
import { FormError } from "@/components/form-error"
import { Button } from "@/components/ui/button"
import { decideRequest } from "@/features/authorize/api"
import { env } from "@/env"
import { useI18n } from "@/i18n"
import { secretStore } from "@/lib/flow-memory"
import { followRedirect } from "@/lib/navigation"
import { authSearch } from "@/lib/search"

/** Neutral tone, no red page: the account can't sign in, here's why, here's who to ask. */
export const Route = createFileRoute("/_auth/banned")({
  validateSearch: authSearch,
  component: BannedPage,
})

function BannedPage() {
  const { req } = Route.useSearch()
  const { t, formatDate } = useI18n()
  const details = secretStore.get("banned")
  const back = useMutation({
    mutationFn: () => decideRequest(req!, "deny"),
    onSuccess: (res) => followRedirect(res.redirect_to),
  })
  const reason = typeof details?.public_reason === "string" ? details.public_reason : null
  return (
    <>
      <AuthHeader title={t("auth.banned.title")} lead={t("auth.banned.lead")} />
      {reason ? (
        <figure className="mb-5 rounded-2xl bg-surface-muted p-5 ring-1 ring-line">
          <figcaption className="mb-2 text-xs font-semibold tracking-widest text-eyebrow uppercase">
            {t("auth.banned.reason")}
          </figcaption>
          <blockquote className="text-foreground">{reason}</blockquote>
        </figure>
      ) : null}
      <dl className="mb-5 space-y-1 text-sm text-muted">
        {details?.since ? <dd>{t("auth.banned.since", { date: formatDate(details.since) })}</dd> : null}
        {details?.until ? (
          <dd>{t("auth.banned.until", { date: formatDate(details.until) })}</dd>
        ) : details ? (
          <dd>{t("auth.banned.permanent")}</dd>
        ) : null}
      </dl>
      <p className="mb-6 text-sm text-muted">{t("auth.banned.contact")}</p>
      {back.error ? <FormError className="mb-4" error={back.error} /> : null}
      <div className="space-y-3">
        <Button asChild block>
          <a href={`mailto:${env.supportEmail}`}>
            <Mail className="size-4" aria-hidden />
            {t("common.contactSupport")}
          </a>
        </Button>
        <Button asChild block variant="secondary">
          <Link to="/signin" search={{ req }}>
            {t("auth.banned.useAnother")}
          </Link>
        </Button>
        {req ? (
          <Button block variant="ghost" loading={back.isPending} onClick={() => back.mutate()}>
            {t("auth.banned.backToApp")}
          </Button>
        ) : null}
      </div>
    </>
  )
}
