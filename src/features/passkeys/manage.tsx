import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { qk } from "@/api/queries"
import type { Passkey } from "@/api/schema"
import { FormError } from "@/components/form-error"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toaster"
import { ConfirmDialog } from "@/features/account/confirm-dialog"
import { useSudo } from "@/features/account/use-sudo"
import { useI18n } from "@/i18n"
import type { TKey } from "@/i18n/types"
import { isGezcezError } from "@/lib/errors"
import { useHandleApiError } from "@/lib/use-api-error"
import { deletePasskey, renamePasskey } from "./api"
import { MAX_PASSKEY_NAME, suggestPasskeyName } from "./device-name"
import { registerPasskey } from "./register"
import { ceremonyFailure, supportsPasskeys, type CeremonyFailure } from "./webauthn"

type Dialogs = { kind: "add" } | { kind: "rename"; passkey: Passkey } | { kind: "remove"; passkey: Passkey }

/**
 * The passkeys part of /account/security (oauth.md 5.11): list, add, rename, remove.
 * Every change is sudo, so each one checks the step-up window before opening its dialog.
 */
export function usePasskeyManager() {
  const [dialog, setDialog] = useState<Dialogs | null>(null)
  const [supported] = useState(supportsPasskeys)
  const sudo = useSudo()
  const open = (d: Dialogs) => {
    if (sudo()) setDialog(d)
  }
  const close = () => setDialog(null)
  return { supported, dialog, open, close }
}

async function refreshSecurity(qc: ReturnType<typeof useQueryClient>) {
  await qc.invalidateQueries({ queryKey: qk.security })
  await qc.invalidateQueries({ queryKey: qk.profile })
}

export function PasskeyList({
  passkeys,
  onRename,
  onRemove,
}: {
  passkeys: Passkey[]
  onRename: (p: Passkey) => void
  onRemove: (p: Passkey) => void
}) {
  const { t, formatDate, formatRelative } = useI18n()
  if (passkeys.length === 0) return null
  return (
    <ul aria-label={t("account.security.passkeyList")} className="space-y-2">
      {passkeys.map((p) => (
        <li
          key={p.id}
          className="flex flex-col gap-3 rounded-xl bg-surface-muted px-4 py-3 ring-1 ring-line sm:flex-row sm:items-center"
        >
          <div className="min-w-0 flex-1">
            <p className="font-semibold break-words">{p.name}</p>
            <p className="text-sm text-muted">
              {[
                p.device_hint,
                t("account.security.passkeyAdded", { date: formatDate(p.created_at) }),
                p.last_used_at
                  ? t("account.security.passkeyUsed", { time: formatRelative(p.last_used_at) })
                  : t("account.security.passkeyNeverUsed"),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              aria-label={t("account.security.renamePasskeyNamed", { name: p.name })}
              onClick={() => onRename(p)}
            >
              {t("account.security.renamePasskey")}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              aria-label={t("account.security.removePasskeyNamed", { name: p.name })}
              onClick={() => onRemove(p)}
            >
              {t("common.remove")}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}

const ADD_FAILURE_COPY = {
  cancelled: "account.security.passkeyCancelled",
  exists: "account.security.passkeyExists",
  unsupported: "account.security.passkeyUnsupportedDevice",
  failed: "account.security.passkeyFailed",
} as const satisfies Record<CeremonyFailure, TKey>

function useNameSchema() {
  const { t } = useI18n()
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t("account.security.passkeyNameRequired"))
      .max(MAX_PASSKEY_NAME, t("account.security.passkeyNameTooLong", { max: MAX_PASSKEY_NAME })),
  })
}

function defaultName(fallback: string): string {
  if (typeof navigator === "undefined") return fallback
  return suggestPasskeyName(navigator.userAgent, navigator.platform) || fallback
}

export function AddPasskeyDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const handle = useHandleApiError()
  const schema = useNameSchema()
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: defaultName(t("account.security.passkeyDefaultName")) },
  })
  const [failure, setFailure] = useState<CeremonyFailure | null>(null)
  const m = useMutation({
    mutationFn: (v: z.infer<typeof schema>) => registerPasskey(v.name),
    onMutate: () => setFailure(null),
    onSuccess: async (p) => {
      onOpenChange(false)
      form.reset()
      toast(t("account.security.passkeyAddedToast", { name: p.name }))
      await refreshSecurity(qc)
    },
    onError: (e) => {
      // CONFLICT: the backend already has this credential (excludeCredentials was not honoured).
      const f = ceremonyFailure(e) ?? (isGezcezError(e) && e.code === "CONFLICT" ? "exists" : null)
      if (f) setFailure(f)
      else if (handle(e)) onOpenChange(false)
    },
  })
  const apiError = m.error && !failure ? m.error : null
  const change = (o: boolean) => {
    if (!o) {
      setFailure(null)
      m.reset()
    }
    onOpenChange(o)
  }
  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent
        title={t("account.security.addPasskey")}
        description={t("account.security.addPasskeyBody")}
      >
        <form noValidate className="space-y-5" onSubmit={form.handleSubmit((v) => m.mutate(v))}>
          <Field
            label={t("account.security.passkeyName")}
            hint={t("account.security.passkeyNameHint")}
            error={form.formState.errors.name?.message}
          >
            <Input autoComplete="off" maxLength={MAX_PASSKEY_NAME} autoFocus {...form.register("name")} />
          </Field>
          {failure ? (
            <Alert tone={failure === "cancelled" ? "info" : "error"}>{t(ADD_FAILURE_COPY[failure])}</Alert>
          ) : null}
          {apiError ? <FormError error={apiError} /> : null}
          <Button type="submit" block loading={m.isPending}>
            {t("common.continue")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function RenamePasskeyDialog({
  passkey,
  onOpenChange,
}: {
  passkey: Passkey | null
  onOpenChange: (o: boolean) => void
}) {
  const { t } = useI18n()
  return (
    <Dialog open={Boolean(passkey)} onOpenChange={onOpenChange}>
      <DialogContent title={t("account.security.renamePasskeyTitle")}>
        {passkey ? (
          <RenameForm key={passkey.id} passkey={passkey} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function RenameForm({ passkey, onDone }: { passkey: Passkey; onDone: () => void }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const handle = useHandleApiError()
  const schema = useNameSchema()
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: passkey.name },
  })
  const m = useMutation({
    mutationFn: (v: z.infer<typeof schema>) => renamePasskey(passkey.id, v.name),
    onSuccess: async () => {
      onDone()
      toast(t("account.security.passkeyRenamed"))
      await refreshSecurity(qc)
    },
    onError: (e) => {
      if (handle(e)) onDone()
    },
  })
  return (
    <form noValidate className="space-y-5" onSubmit={form.handleSubmit((v) => m.mutate(v))}>
      <Field label={t("account.security.passkeyName")} error={form.formState.errors.name?.message}>
        <Input autoComplete="off" maxLength={MAX_PASSKEY_NAME} autoFocus {...form.register("name")} />
      </Field>
      {m.error ? <FormError error={m.error} /> : null}
      <Button type="submit" block loading={m.isPending}>
        {t("common.save")}
      </Button>
    </form>
  )
}

export function RemovePasskeyDialog({
  passkey,
  onOpenChange,
}: {
  passkey: Passkey | null
  onOpenChange: (o: boolean) => void
}) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const handle = useHandleApiError()
  // Keep the name on screen while the dialog animates closed.
  const [last, setLast] = useState(passkey)
  if (passkey && passkey !== last) setLast(passkey)
  const m = useMutation({
    mutationFn: (p: Passkey) => deletePasskey(p.id),
    onSuccess: async (_, p) => {
      onOpenChange(false)
      toast(t("account.security.passkeyRemoved", { name: p.name }))
      await refreshSecurity(qc)
    },
    onError: (e) => {
      onOpenChange(false)
      handle(e, { toastInline: true })
    },
  })
  const name = last?.name ?? ""
  return (
    <ConfirmDialog
      open={Boolean(passkey)}
      onOpenChange={onOpenChange}
      title={t("account.security.removePasskeyTitle", { name })}
      body={t("account.security.removePasskeyBody")}
      confirmLabel={t("account.security.removePasskey")}
      destructive
      loading={m.isPending}
      onConfirm={() => passkey && m.mutate(passkey)}
    />
  )
}
