import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Download, ExternalLink, Trash2 } from "lucide-react"
import { useId } from "react"
import { api, unwrap } from "@/api/client"
import { exportsQuery, privacyQuery, qk } from "@/api/queries"
import type { DataExport, PrivacySettings } from "@/api/schema"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toaster"
import { AccountPage, LoadError, Loading, Section } from "@/features/account/page"
import { downloadExport } from "@/features/account/privacy/download"
import { useSudo } from "@/features/account/use-sudo"
import { env } from "@/env"
import { useI18n } from "@/i18n"
import { cn } from "@/lib/cn"
import { useHandleApiError } from "@/lib/use-api-error"

export const Route = createFileRoute("/account/privacy/")({
  component: PrivacyPage,
})

function PrivacyPage() {
  const { t } = useI18n()
  const privacy = useQuery(privacyQuery)
  return (
    <AccountPage title={t("account.privacy.title")} lead={t("account.privacy.lead")}>
      <Section title={t("account.privacy.settings")} id="settings">
        {privacy.isPending ? (
          <Loading />
        ) : privacy.error ? (
          <LoadError error={privacy.error} retry={() => void privacy.refetch()} />
        ) : (
          <Toggles settings={privacy.data} />
        )}
      </Section>
      <Exports />
      <Section
        title={t("account.privacy.providers")}
        description={t("account.privacy.providersBody")}
        id="providers"
      >
        <a
          href={`${env.wwwUrl}/privacy/providers`}
          className="inline-flex min-h-11 items-center gap-1 font-medium text-link underline-offset-4 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          {t("account.privacy.providersLink")}
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </Section>
      <Section
        title={t("account.privacy.deleteTitle")}
        description={t("account.privacy.deleteBody")}
        id="delete"
      >
        <Button asChild variant="destructive" className="self-start">
          <Link to="/account/privacy/delete">
            <Trash2 className="size-4" aria-hidden />
            {t("account.privacy.deleteLink")}
          </Link>
        </Button>
      </Section>
    </AccountPage>
  )
}

function Toggles({ settings }: { settings: PrivacySettings }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const handle = useHandleApiError()
  const m = useMutation({
    mutationFn: (patch: Partial<PrivacySettings>) =>
      unwrap(api.PATCH("/v1/account/privacy", { body: patch })),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: qk.privacy })
      const prev = qc.getQueryData<PrivacySettings>(qk.privacy)
      qc.setQueryData<PrivacySettings>(qk.privacy, (old) => (old ? { ...old, ...patch } : old))
      return { prev }
    },
    onError: (e, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.privacy, ctx.prev)
      handle(e, { toastInline: true })
    },
    onSuccess: (data) => {
      qc.setQueryData(qk.privacy, data)
      toast(t("account.privacy.saved"))
    },
  })
  return (
    <ul className="divide-y divide-line">
      <ToggleRow
        label={t("account.privacy.locationHistory")}
        body={t("account.privacy.locationHistoryBody")}
        checked={settings.location_history_opt_in}
        onChange={(v) => m.mutate({ location_history_opt_in: v })}
      />
      <ToggleRow
        label={t("account.privacy.productEmails")}
        body={t("account.privacy.productEmailsBody")}
        checked={settings.product_emails}
        onChange={(v) => m.mutate({ product_emails: v })}
      />
    </ul>
  )
}

function ToggleRow({
  label,
  body,
  checked,
  onChange,
}: {
  label: string
  body: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  const id = useId()
  return (
    <li className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div>
        <label htmlFor={id} className="cursor-pointer font-semibold">
          {label}
        </label>
        <p id={`${id}-d`} className="text-sm text-muted">
          {body}
        </p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-describedby={`${id}-d`} />
    </li>
  )
}

function Exports() {
  const { t } = useI18n()
  const qc = useQueryClient()
  const sudo = useSudo()
  const handle = useHandleApiError()
  const exports = useQuery(exportsQuery)
  const request = useMutation({
    mutationFn: () => unwrap(api.POST("/v1/account/export")),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.exports })
    },
    onError: (e) => handle(e, { toastInline: true }),
  })
  const hasQueued = exports.data?.exports.some((e) => e.status === "queued")
  return (
    <Section
      title={t("account.privacy.exportTitle")}
      description={t("account.privacy.exportBody")}
      id="export"
    >
      {request.isSuccess ? <Alert tone="success">{t("account.privacy.exportRequested")}</Alert> : null}
      <div>
        <Button
          variant="secondary"
          loading={request.isPending}
          disabled={hasQueued}
          onClick={() => sudo() && request.mutate()}
        >
          {t("account.privacy.exportRequest")}
        </Button>
      </div>
      <div className="space-y-2 border-t border-line pt-4">
        <h3 className="text-sm font-semibold">{t("account.privacy.exportList")}</h3>
        {exports.isPending ? (
          <Loading />
        ) : exports.error ? (
          <LoadError error={exports.error} retry={() => void exports.refetch()} />
        ) : exports.data.exports.length === 0 ? (
          <p className="text-sm text-muted">{t("account.privacy.exportEmpty")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {exports.data.exports.map((e) => (
              <ExportRow key={e.id} item={e} />
            ))}
          </ul>
        )}
      </div>
    </Section>
  )
}

function ExportRow({ item }: { item: DataExport }) {
  const { t, formatDate } = useI18n()
  const sudo = useSudo()
  const handle = useHandleApiError()
  const dl = useMutation({
    mutationFn: () => downloadExport(item.id),
    onError: (e) => handle(e, { toastInline: true }),
  })
  const size = item.size_bytes ? `${Math.max(1, Math.round(item.size_bytes / 1024))} KB` : null
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-3 py-3">
      <div className="min-w-0 space-y-1">
        <p className="font-medium">
          {t("account.privacy.exportRequestedAt", { date: formatDate(item.created_at) })}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              item.status === "ready"
                ? "bg-success-bg text-success"
                : item.status === "queued"
                  ? "bg-info-bg text-foreground"
                  : "bg-surface-muted text-muted",
            )}
          >
            {t(`account.privacy.exportStatus.${item.status}`)}
          </span>
          {[
            item.status === "ready" && item.expires_at
              ? t("account.privacy.exportExpires", { date: formatDate(item.expires_at) })
              : null,
            size,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      {item.status === "ready" ? (
        <Button size="sm" variant="secondary" loading={dl.isPending} onClick={() => sudo() && dl.mutate()}>
          <Download className="size-4" aria-hidden />
          {t("account.privacy.download")}
        </Button>
      ) : null}
    </li>
  )
}
