import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { ChevronRight, Plus, X } from "lucide-react"
import { useState } from "react"
import { deviceAccountsQuery, qk } from "@/api/queries"
import type { DeviceAccount } from "@/api/schema"
import { AuthHeader } from "@/components/auth-header"
import { Avatar } from "@/components/brand/number-badge"
import { FormError } from "@/components/form-error"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toaster"
import { useContinueRequest } from "@/features/authorize/api"
import { forgetDeviceAccount, switchSession } from "@/features/session/api"
import { useInternalNav } from "@/lib/use-internal-nav"
import { useAuthRequest } from "@/features/session/use-auth-request"
import { useI18n } from "@/i18n"
import { invalidateCsrfToken } from "@/lib/csrf"
import { cn } from "@/lib/cn"
import { authSearch } from "@/lib/search"

export const Route = createFileRoute("/_auth/choose")({
  validateSearch: authSearch,
  component: ChoosePage,
})

function ChoosePage() {
  const { req, return: returnTo } = Route.useSearch()
  const { t } = useI18n()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const request = useAuthRequest(req)
  const accounts = useQuery(deviceAccountsQuery)
  const cont = useContinueRequest()
  const [managing, setManaging] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)

  const go = useInternalNav()
  const switcher = useMutation({
    mutationFn: (id: string) => switchSession(id),
    onSuccess: async () => {
      invalidateCsrfToken()
      await qc.invalidateQueries({ queryKey: ["account"] })
      go(returnTo ?? "/account", { replace: true })
    },
  })

  const forget = useMutation({
    mutationFn: (id: string) => forgetDeviceAccount(id),
    onSuccess: async () => {
      toast(t("auth.choose.removed"))
      await qc.invalidateQueries({ queryKey: qk.deviceAccounts })
    },
  })

  const pick = (a: DeviceAccount) => {
    if (a.signed_out) {
      void navigate({ to: "/signin", search: { req, return: returnTo } })
      return
    }
    setPicked(a.session_id)
    invalidateCsrfToken()
    if (req) cont.mutate({ req, sessionId: a.session_id })
    else switcher.mutate(a.session_id)
  }

  const list = accounts.data?.accounts ?? []
  const clientName = request.data?.client.name
  return (
    <>
      <AuthHeader
        eyebrow={clientName ? t("auth.eyebrow.signinTo", { client: clientName }) : t("auth.eyebrow.account")}
        title={t("auth.choose.title")}
        lead={clientName ? t("auth.choose.lead", { client: clientName }) : t("auth.choose.leadGeneric")}
      />
      {accounts.isPending ? (
        <div className="flex justify-center py-8">
          <Spinner label={t("common.loading")} />
        </div>
      ) : accounts.error ? (
        <FormError
          error={accounts.error}
          action={
            <Button size="sm" variant="secondary" onClick={() => void accounts.refetch()}>
              {t("common.retry")}
            </Button>
          }
        />
      ) : (
        <ul className="-mx-2 divide-y divide-line" aria-busy={cont.isPending || switcher.isPending}>
          {list.length === 0 ? <li className="px-2 py-4 text-muted">{t("auth.choose.empty")}</li> : null}
          {list.map((a) => (
            <li key={a.session_id} className="flex items-center">
              <button
                type="button"
                onClick={() => pick(a)}
                disabled={managing || cont.isPending || switcher.isPending}
                className={cn(
                  "flex min-h-16 flex-1 items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-default disabled:hover:bg-transparent",
                )}
              >
                <Avatar
                  initials={a.account.avatar_initials}
                  className={cn("size-10", a.signed_out && "opacity-60 grayscale")}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{a.account.display_name}</span>
                  <span className="block truncate text-sm text-muted">{a.account.email_masked}</span>
                </span>
                {a.signed_out ? (
                  <span className="text-xs font-medium text-subtle">{t("auth.choose.signedOut")}</span>
                ) : null}
                {(cont.isPending || switcher.isPending) && picked === a.session_id ? (
                  <Spinner />
                ) : !managing ? (
                  <ChevronRight className="size-5 text-subtle" aria-hidden />
                ) : null}
              </button>
              {managing && a.signed_out ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("auth.choose.removeAccount", { name: a.account.display_name })}
                  loading={forget.isPending && forget.variables === a.session_id}
                  onClick={() => forget.mutate(a.session_id)}
                >
                  <X className="size-5" aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
          <li>
            <Link
              to="/signin"
              search={{ req, return: returnTo }}
              className="flex min-h-16 items-center gap-3 rounded-xl px-2 py-3 font-semibold hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-full ring-1 ring-line-strong">
                <Plus className="size-5" aria-hidden />
              </span>
              {t("auth.choose.useAnother")}
            </Link>
          </li>
        </ul>
      )}
      {cont.error || switcher.error ? (
        <FormError className="mt-4" error={cont.error ?? switcher.error} />
      ) : null}
      {forget.error ? <FormError className="mt-4" error={forget.error} /> : null}
      {list.some((a) => a.signed_out) ? (
        <div className="mt-5 border-t border-line pt-5 text-sm">
          <Button variant="link" onClick={() => setManaging((m) => !m)}>
            {managing ? t("auth.choose.done") : t("auth.choose.manage")}
          </Button>
        </div>
      ) : null}
    </>
  )
}
