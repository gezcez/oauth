import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { BadgeCheck } from "lucide-react"
import { useState } from "react"
import { api, unwrap } from "@/api/client"
import { appsQuery, qk } from "@/api/queries"
import type { ConnectedApp } from "@/api/schema"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toaster"
import { ConfirmDialog } from "@/features/account/confirm-dialog"
import { AccountPage, LoadError, Loading, Section } from "@/features/account/page"
import { ClientLogo } from "@/features/authorize/client-header"
import { ScopeList } from "@/features/consent/scope-list"
import { useI18n } from "@/i18n"
import { useHandleApiError } from "@/lib/use-api-error"

export const Route = createFileRoute("/account/apps")({
  component: AppsPage,
})

function AppsPage() {
  const { t } = useI18n()
  const apps = useQuery(appsQuery)
  if (apps.isPending) return <Loading />
  if (apps.error) return <LoadError error={apps.error} retry={() => void apps.refetch()} />
  return (
    <AccountPage title={t("account.apps.title")} lead={t("account.apps.lead")}>
      {apps.data.apps.length === 0 ? (
        <Section>
          <p className="text-muted">{t("account.apps.empty")}</p>
        </Section>
      ) : (
        <ul className="space-y-4">
          {apps.data.apps.map((a) => (
            <li key={a.client_id}>
              <AppCard app={a} />
            </li>
          ))}
        </ul>
      )}
    </AccountPage>
  )
}

function AppCard({ app }: { app: ConnectedApp }) {
  const { t, formatDate, formatRelative } = useI18n()
  const qc = useQueryClient()
  const handle = useHandleApiError()
  const [confirm, setConfirm] = useState(false)
  const remove = useMutation({
    mutationFn: () =>
      unwrap(api.DELETE("/v1/account/apps/{clientId}", { params: { path: { clientId: app.client_id } } })),
    onSuccess: async () => {
      setConfirm(false)
      toast(t("account.apps.removed", { app: app.name }))
      await qc.invalidateQueries({ queryKey: qk.apps })
    },
    onError: (e) => {
      setConfirm(false)
      handle(e, { toastInline: true })
    },
  })
  return (
    <Section>
      <div className="flex flex-wrap items-start gap-4">
        <ClientLogo client={app} size={44} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold">{app.name}</h2>
            {app.first_party ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-info-bg px-2.5 py-0.5 text-xs font-semibold">
                <BadgeCheck className="size-3.5" aria-hidden />
                {t("account.apps.madeByGezcez")}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted">
            {t("account.apps.granted", { date: formatDate(app.granted_at) })} ·{" "}
            {app.last_used_at
              ? t("account.apps.lastUsed", { time: formatRelative(app.last_used_at) })
              : t("account.apps.neverUsed")}
          </p>
        </div>
        <Button variant="destructive" size="md" onClick={() => setConfirm(true)}>
          {t("account.apps.remove")}
        </Button>
      </div>
      <div className="space-y-3 border-t border-line pt-4">
        <p className="text-sm font-semibold">{t("account.apps.canAccess")}</p>
        <ScopeList scopes={app.scopes} />
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("account.apps.removeTitle", { app: app.name })}
        body={t("account.apps.removeBody", { app: app.name })}
        confirmLabel={t("account.apps.remove")}
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </Section>
  )
}
