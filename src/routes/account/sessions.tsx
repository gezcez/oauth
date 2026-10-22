import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { AppWindow, Laptop, Smartphone } from "lucide-react"
import { useState } from "react"
import { api, unwrap } from "@/api/client"
import { qk, sessionsQuery } from "@/api/queries"
import type { SessionEntry } from "@/api/schema"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toaster"
import { ConfirmDialog } from "@/features/account/confirm-dialog"
import { AccountPage, LoadError, Loading, Section } from "@/features/account/page"
import { useSudo } from "@/features/account/use-sudo"
import { logout } from "@/features/session/api"
import { useI18n } from "@/i18n"
import { invalidateCsrfToken } from "@/lib/csrf"
import { useHandleApiError } from "@/lib/use-api-error"

export const Route = createFileRoute("/account/sessions")({
  component: SessionsPage,
})

function SessionsPage() {
  const { t, tp } = useI18n()
  const sessions = useQuery(sessionsQuery)
  const qc = useQueryClient()
  const sudo = useSudo()
  const handle = useHandleApiError()
  const [confirmOthers, setConfirmOthers] = useState(false)
  const revokeOthers = useMutation({
    mutationFn: () => unwrap(api.POST("/v1/account/sessions/revoke-others")),
    onSuccess: async (res) => {
      setConfirmOthers(false)
      toast(tp("account.sessions.signedOutOthers", res.revoked))
      await qc.invalidateQueries({ queryKey: qk.sessions })
    },
    onError: (e) => {
      setConfirmOthers(false)
      handle(e, { toastInline: true })
    },
  })
  if (sessions.isPending) return <Loading />
  if (sessions.error) return <LoadError error={sessions.error} retry={() => void sessions.refetch()} />
  const list = [...sessions.data.sessions].sort(
    (a, b) => Number(b.current) - Number(a.current) || b.last_seen_at.localeCompare(a.last_seen_at),
  )
  const others = list.filter((s) => !s.current)
  return (
    <AccountPage title={t("account.sessions.title")} lead={t("account.sessions.lead")}>
      <ul className="space-y-4">
        {list.map((s) => (
          <li key={s.id}>
            <SessionCard session={s} />
          </li>
        ))}
      </ul>
      {others.length === 0 ? <p className="text-muted">{t("account.sessions.empty")}</p> : null}
      {others.length > 0 ? (
        <div className="flex justify-end">
          <Button variant="destructive" onClick={() => sudo() && setConfirmOthers(true)}>
            {t("account.sessions.signOutOthers")}
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmOthers}
        onOpenChange={setConfirmOthers}
        title={t("account.sessions.signOutOthersTitle")}
        body={t("account.sessions.signOutOthersBody")}
        confirmLabel={t("account.sessions.signOutOthers")}
        destructive
        loading={revokeOthers.isPending}
        onConfirm={() => revokeOthers.mutate()}
      />
    </AccountPage>
  )
}

function SessionCard({ session: s }: { session: SessionEntry }) {
  const { t, formatRelative, formatDate } = useI18n()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const handle = useHandleApiError()
  const [confirm, setConfirm] = useState(false)
  const Icon = s.device.kind === "mobile" ? Smartphone : s.device.kind === "app" ? AppWindow : Laptop
  const revoke = useMutation({
    mutationFn: async () => {
      if (s.current) return logout({ scope: "session" })
      return unwrap(api.DELETE("/v1/account/sessions/{sessionId}", { params: { path: { sessionId: s.id } } }))
    },
    onSuccess: async () => {
      setConfirm(false)
      if (s.current) {
        invalidateCsrfToken()
        qc.clear()
        await navigate({ to: "/signed-out", replace: true })
        return
      }
      toast(t("account.sessions.signedOut", { device: s.device.label }))
      await qc.invalidateQueries({ queryKey: qk.sessions })
    },
    onError: (e) => {
      setConfirm(false)
      handle(e, { toastInline: true })
    },
  })
  return (
    <Section className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-start">
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-muted ring-1 ring-line">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-bold">{s.device.label}</h2>
          {s.current ? (
            <span className="rounded-full bg-gradient-to-br from-brand-yellow-400 to-brand-amber-500 px-2.5 py-0.5 text-xs font-semibold text-navy">
              {t("account.sessions.thisDevice")}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted">
          {[
            s.approx_location ? t("account.sessions.location", { place: s.approx_location }) : null,
            t("account.sessions.lastActive", { time: formatRelative(s.last_seen_at) }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="text-sm text-subtle">
          {t("account.sessions.signedInAt", { date: formatDate(s.created_at) })}
          {s.amr.length ? ` · ${s.amr.map((m) => t(`account.sessions.method.${m}`)).join(", ")}` : ""}
        </p>
        {s.apps.length ? (
          <p className="text-sm text-subtle">
            {t("account.sessions.appsUsed", { apps: s.apps.map((a) => a.name).join(", ") })}
          </p>
        ) : null}
      </div>
      <Button variant="secondary" size="md" onClick={() => setConfirm(true)}>
        {t("account.sessions.signOut")}
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("account.sessions.signOutConfirmTitle", { device: s.device.label })}
        body={t("account.sessions.signOutConfirmBody")}
        confirmLabel={t("account.sessions.signOut")}
        destructive
        loading={revoke.isPending}
        onConfirm={() => revoke.mutate()}
      />
    </Section>
  )
}
