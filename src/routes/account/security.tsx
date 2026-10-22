import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Fingerprint, KeyRound, Mail } from "lucide-react"
import { useState, type ReactNode } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { api, unwrap } from "@/api/client"
import { qk, securityQuery } from "@/api/queries"
import { FormError } from "@/components/form-error"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { toast } from "@/components/ui/toaster"
import { ConfirmDialog } from "@/features/account/confirm-dialog"
import { AccountPage, LoadError, Loading, Section } from "@/features/account/page"
import { useSudo } from "@/features/account/use-sudo"
import {
  AddPasskeyDialog,
  PasskeyList,
  RemovePasskeyDialog,
  RenamePasskeyDialog,
  usePasskeyManager,
} from "@/features/passkeys/manage"
import { MAX_PASSWORD, MIN_PASSWORD, NewPasswordField } from "@/features/password/new-password-field"
import { useI18n } from "@/i18n"
import { lookup, catalogs } from "@/i18n/translate"
import { toGezcezError } from "@/lib/errors"
import { useErrorMessage, useHandleApiError } from "@/lib/use-api-error"

export const Route = createFileRoute("/account/security")({
  component: SecurityPage,
})

function SecurityPage() {
  const { t, locale, formatDate, formatRelative } = useI18n()
  const security = useQuery(securityQuery)
  const qc = useQueryClient()
  const sudo = useSudo()
  const handle = useHandleApiError()
  const [editing, setEditing] = useState(false)
  const [removing, setRemoving] = useState(false)
  const passkeys = usePasskeyManager()
  const remove = useMutation({
    mutationFn: () => unwrap(api.DELETE("/v1/account/password")),
    onSuccess: async () => {
      setRemoving(false)
      toast(t("account.security.removed"))
      await qc.invalidateQueries({ queryKey: ["account"] })
    },
    onError: (e) => {
      setRemoving(false)
      handle(e, { toastInline: true })
    },
  })
  if (security.isPending) return <Loading />
  if (security.error) return <LoadError error={security.error} retry={() => void security.refetch()} />
  const s = security.data
  return (
    <AccountPage title={t("account.security.title")} lead={t("account.security.lead")}>
      <Section title={t("account.security.methods")} id="methods">
        <ul className="divide-y divide-line">
          <MethodRow
            icon={<Mail className="size-5" aria-hidden />}
            title={t("account.security.emailCodes")}
            body={t("account.security.emailCodesBody")}
          >
            <span className="rounded-full bg-success-bg px-3 py-1 text-xs font-semibold text-success">
              {t("account.security.alwaysOn")}
            </span>
          </MethodRow>
          <MethodRow
            icon={<KeyRound className="size-5" aria-hidden />}
            title={t("account.security.password")}
            body={
              s.has_password
                ? s.password_updated_at
                  ? t("account.security.passwordSet", { date: formatDate(s.password_updated_at) })
                  : t("account.security.passwordSetNoDate")
                : t("account.security.passwordNone")
            }
          >
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => sudo() && setEditing(true)}>
                {s.has_password ? t("account.security.changePassword") : t("account.security.addPassword")}
              </Button>
              {s.has_password ? (
                <Button size="sm" variant="destructive" onClick={() => sudo() && setRemoving(true)}>
                  {t("account.security.removePassword")}
                </Button>
              ) : null}
            </div>
          </MethodRow>
          <MethodRow
            icon={<Fingerprint className="size-5" aria-hidden />}
            title={t("account.security.passkeys")}
            body={
              passkeys.supported
                ? t("account.security.passkeysBody")
                : t("account.security.passkeysUnsupported")
            }
            below={
              <PasskeyList
                passkeys={s.passkeys}
                onRename={(passkey) => passkeys.open({ kind: "rename", passkey })}
                onRemove={(passkey) => passkeys.open({ kind: "remove", passkey })}
              />
            }
          >
            {passkeys.supported ? (
              <Button size="sm" variant="secondary" onClick={() => passkeys.open({ kind: "add" })}>
                {t("account.security.addPasskey")}
              </Button>
            ) : null}
          </MethodRow>
        </ul>
      </Section>

      <Section title={t("account.security.events")} id="events">
        {s.recent_events.length === 0 ? (
          <p className="text-muted">{t("account.security.eventsEmpty")}</p>
        ) : (
          <ol className="divide-y divide-line">
            {s.recent_events.map((e, i) => (
              <li
                key={`${e.type}-${e.at}-${i}`}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
              >
                <span className="font-medium">
                  {lookup(catalogs[locale].account.security.eventTypes, e.type) ??
                    t("account.security.eventTypes.other")}
                </span>
                <span className="text-sm text-muted">
                  {[e.device_label, e.approx_location, formatRelative(e.at)].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <PasswordDialog open={editing} onOpenChange={setEditing} hasPassword={s.has_password} />
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={t("account.security.removeTitle")}
        body={t("account.security.removeBody")}
        confirmLabel={t("account.security.removePassword")}
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
      <AddPasskeyDialog open={passkeys.dialog?.kind === "add"} onOpenChange={(o) => !o && passkeys.close()} />
      <RenamePasskeyDialog
        passkey={passkeys.dialog?.kind === "rename" ? passkeys.dialog.passkey : null}
        onOpenChange={(o) => !o && passkeys.close()}
      />
      <RemovePasskeyDialog
        passkey={passkeys.dialog?.kind === "remove" ? passkeys.dialog.passkey : null}
        onOpenChange={(o) => !o && passkeys.close()}
      />
    </AccountPage>
  )
}

function MethodRow({
  icon,
  title,
  body,
  children,
  below,
}: {
  icon: ReactNode
  title: string
  body: string
  children?: ReactNode
  /** Full-width content under the row, such as the passkey list. */
  below?: ReactNode
}) {
  return (
    <li className="space-y-4 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted ring-1 ring-line">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted">{body}</p>
        </div>
        {children}
      </div>
      {below}
    </li>
  )
}

function PasswordDialog({
  open,
  onOpenChange,
  hasPassword,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  hasPassword: boolean
}) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const handle = useHandleApiError()
  const message = useErrorMessage()
  const schema = z.object({
    password: z
      .string()
      .min(MIN_PASSWORD, t("auth.password.tooShort"))
      .max(MAX_PASSWORD, t("auth.password.tooLong")),
    keep: z.boolean(),
  })
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", keep: false },
  })
  const value = form.watch("password")
  const m = useMutation({
    mutationFn: (v: z.infer<typeof schema>) =>
      unwrap(api.PUT("/v1/account/password", { body: { new_password: v.password, keep_sessions: v.keep } })),
    onSuccess: async () => {
      onOpenChange(false)
      form.reset()
      toast(t("account.security.savedPassword"))
      await qc.invalidateQueries({ queryKey: qk.security })
      await qc.invalidateQueries({ queryKey: qk.profile })
    },
    onError: (e) => {
      const err = toGezcezError(e)
      if (err.code === "AUTH_PASSWORD_WEAK" || err.code === "AUTH_PASSWORD_BREACHED")
        form.setError("password", { message: message(err) })
      else if (handle(err)) onOpenChange(false)
    },
  })
  const err = m.error ? toGezcezError(m.error) : null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={hasPassword ? t("account.security.changePassword") : t("account.security.addPassword")}
      >
        <form noValidate className="space-y-5" onSubmit={form.handleSubmit((v) => m.mutate(v))}>
          <input type="email" autoComplete="username" hidden readOnly />
          <NewPasswordField
            value={value}
            error={form.formState.errors.password?.message}
            autoFocus
            {...form.register("password")}
          />
          <Controller
            control={form.control}
            name="keep"
            render={({ field }) => (
              <div className="flex min-h-11 items-center gap-3">
                <Checkbox
                  id="keep-sessions"
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                />
                <label htmlFor="keep-sessions" className="cursor-pointer text-sm">
                  {t("account.security.keepSessions")}
                </label>
              </div>
            )}
          />
          {err && err.code !== "AUTH_PASSWORD_WEAK" && err.code !== "AUTH_PASSWORD_BREACHED" ? (
            <FormError error={err} />
          ) : null}
          <Button type="submit" block loading={m.isPending}>
            {t("common.save")}
          </Button>
          <p className="text-xs text-subtle">{t("auth.password.strength.advisory")}</p>
        </form>
      </DialogContent>
    </Dialog>
  )
}
