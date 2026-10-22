import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowRight, ExternalLink } from "lucide-react"
import { sessionQuery } from "@/api/queries"
import { Logo } from "@/components/brand/logo"
import { Eyebrow } from "@/components/brand/eyebrow"
import { Lead, PageHeading } from "@/components/brand/page-heading"
import { FormError } from "@/components/form-error"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { decideRequest } from "@/features/authorize/api"
import { ClientLogo } from "@/features/authorize/client-header"
import { ScopeList } from "@/features/consent/scope-list"
import { AccountChip } from "@/features/session/account-chip"
import { useAuthRequest } from "@/features/session/use-auth-request"
import { useI18n } from "@/i18n"
import { followRedirect } from "@/lib/navigation"
import { authSearch } from "@/lib/search"
import { MissingFlow } from "@/features/email-code/missing-flow"

export const Route = createFileRoute("/_auth/consent")({
  validateSearch: authSearch,
  component: ConsentPage,
})

function ConsentPage() {
  const { req } = Route.useSearch()
  const { t } = useI18n()
  const request = useAuthRequest(req)
  const session = useQuery(sessionQuery)
  const decide = useMutation({
    mutationFn: (d: "approve" | "deny") => decideRequest(req!, d),
    onSuccess: (res) => followRedirect(res.redirect_to),
  })

  if (!req) return <MissingFlow to="/signin" />
  if (request.isPending || session.isPending) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label={t("common.loading")} />
      </div>
    )
  }
  if (request.error || !request.data) return <FormError error={request.error} />
  const client = request.data.client
  const homepage = safeHttps(client.homepage_url)
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3" aria-hidden>
        <Logo wordmark={false} size={40} />
        <ArrowRight className="size-4 text-subtle" />
        <ClientLogo client={client} size={40} />
      </div>
      <div className="space-y-3">
        <Eyebrow>{t("auth.eyebrow.consent")}</Eyebrow>
        <PageHeading>{t("auth.consent.title", { client: client.name })}</PageHeading>
        {!client.first_party ? <Lead className="text-sm">{t("auth.consent.madeBy")}</Lead> : null}
      </div>

      {session.data ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="sr-only">{t("auth.consent.signedInAs")}</span>
          <AccountChip account={session.data.account} />
          <Link
            to="/choose"
            search={{ req }}
            className="text-sm font-medium text-link underline-offset-4 hover:underline"
          >
            {t("auth.consent.notYou")}
          </Link>
        </div>
      ) : null}

      <section aria-labelledby="scopes-title" className="space-y-3">
        <h2 id="scopes-title" className="font-semibold">
          {t("auth.consent.willAccess", { client: client.name })}
        </h2>
        <ScopeList scopes={request.data.scopes} />
      </section>

      {homepage ? (
        <a
          href={homepage}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-sm font-medium text-link underline-offset-4 hover:underline"
        >
          {t("auth.consent.homepage", { client: client.name })}
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      ) : null}
      <p className="text-sm text-subtle">{t("auth.consent.removeLater")}</p>

      {decide.error ? <FormError error={decide.error} /> : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button
          variant="secondary"
          block
          loading={decide.isPending && decide.variables === "deny"}
          disabled={decide.isPending}
          onClick={() => decide.mutate("deny")}
        >
          {t("auth.consent.cancel")}
        </Button>
        <Button
          block
          loading={decide.isPending && decide.variables === "approve"}
          disabled={decide.isPending}
          onClick={() => decide.mutate("approve")}
        >
          {t("auth.consent.allow")}
        </Button>
      </div>
    </div>
  )
}

function safeHttps(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.protocol === "https:" ? u.toString() : null
  } catch {
    return null
  }
}
