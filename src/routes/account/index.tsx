import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { AppWindow, ChevronRight, MonitorSmartphone, ShieldCheck, ShieldHalf } from "lucide-react"
import { useState, type ReactNode } from "react"
import { api, unwrap } from "@/api/client"
import { profileQuery, qk } from "@/api/queries"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toaster"
import { AccountPage, LoadError, Loading } from "@/features/account/page"
import { useI18n } from "@/i18n"
import { secretStore } from "@/lib/flow-memory"
import { useHandleApiError } from "@/lib/use-api-error"

export const Route = createFileRoute("/account/")({
  component: Overview,
})

function Overview() {
  const { t, formatDate } = useI18n()
  const profile = useQuery(profileQuery)
  const qc = useQueryClient()
  const handle = useHandleApiError()
  const [welcome, setWelcome] = useState(() => Boolean(secretStore.take("welcome")))
  const cancel = useMutation({
    mutationFn: () => unwrap(api.POST("/v1/account/delete/cancel")),
    onSuccess: async () => {
      toast(t("auth.pendingDeletion.kept"))
      await qc.invalidateQueries({ queryKey: qk.profile })
    },
    onError: (e) => handle(e, { toastInline: true }),
  })
  if (profile.isPending) return <Loading />
  if (profile.error) return <LoadError error={profile.error} retry={() => void profile.refetch()} />
  const p = profile.data
  return (
    <AccountPage
      title={t("account.overview.title", { name: p.display_name })}
      lead={
        <>
          {p.email} · {t("account.overview.memberSince", { date: formatDate(p.created_at) })}
        </>
      }
    >
      {welcome ? (
        <Alert
          tone="success"
          action={
            <Button size="sm" variant="secondary" onClick={() => setWelcome(false)}>
              {t("account.overview.dismiss")}
            </Button>
          }
        >
          {t("account.overview.welcome")}
        </Alert>
      ) : null}
      {p.deletion ? (
        <Alert
          tone="error"
          action={
            <Button size="sm" loading={cancel.isPending} onClick={() => cancel.mutate()}>
              {t("account.overview.deletionCancel")}
            </Button>
          }
        >
          {t("account.overview.deletionBanner", { date: formatDate(p.deletion.delete_at) })}
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <ShortcutCard
          to="/account/security"
          icon={<ShieldCheck className="size-5" aria-hidden />}
          title={t("account.overview.cards.security.title")}
          body={
            p.has_password && p.passkey_count > 0
              ? t("account.overview.cards.security.withBoth")
              : p.passkey_count > 0
                ? t("account.overview.cards.security.withPasskey")
                : p.has_password
                  ? t("account.overview.cards.security.withPassword")
                  : t("account.overview.cards.security.codesOnly")
          }
        />
        <ShortcutCard
          to="/account/sessions"
          icon={<MonitorSmartphone className="size-5" aria-hidden />}
          title={t("account.overview.cards.sessions.title")}
          body={t("account.overview.cards.sessions.body")}
        />
        <ShortcutCard
          to="/account/apps"
          icon={<AppWindow className="size-5" aria-hidden />}
          title={t("account.overview.cards.apps.title")}
          body={t("account.overview.cards.apps.body")}
        />
        <ShortcutCard
          to="/account/privacy"
          icon={<ShieldHalf className="size-5" aria-hidden />}
          title={t("account.overview.cards.privacy.title")}
          body={t("account.overview.cards.privacy.body")}
        />
      </div>
    </AccountPage>
  )
}

function ShortcutCard({
  to,
  icon,
  title,
  body,
}: {
  to: string
  icon: ReactNode
  title: string
  body: string
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-4 rounded-2xl bg-surface p-5 ring-1 ring-line transition-colors hover:ring-line-strong focus-visible:outline-2 focus-visible:outline-focus"
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-yellow-400 to-brand-amber-500 text-navy">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{title}</span>
        <span className="block text-sm text-muted">{body}</span>
      </span>
      <ChevronRight
        className="mt-1 size-5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  )
}
