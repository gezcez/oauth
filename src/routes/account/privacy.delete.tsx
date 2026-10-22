import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Check, Shield } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { api, unwrap } from "@/api/client"
import { profileQuery, qk } from "@/api/queries"
import { FormError } from "@/components/form-error"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toaster"
import { AccountPage, LoadError, Loading, Section } from "@/features/account/page"
import { useSudo } from "@/features/account/use-sudo"
import { useI18n } from "@/i18n"
import type { TKey } from "@/i18n/types"
import { invalidateCsrfToken } from "@/lib/csrf"
import { toGezcezError } from "@/lib/errors"
import { useHandleApiError } from "@/lib/use-api-error"

/** Deep-linkable from the mobile app for Apple's in-app deletion rule. */
export const Route = createFileRoute("/account/privacy/delete")({
  component: DeletePage,
})

const DELETED = ["profile", "sessions", "apps", "settings", "exports"] as const

function DeletePage() {
  const { t, formatDate } = useI18n()
  const profile = useQuery(profileQuery)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const sudo = useSudo()
  const handle = useHandleApiError()
  const email = profile.data?.email ?? ""
  const schema = z.object({
    confirm: z
      .string()
      .refine((v) => v.trim().toLowerCase() === email.toLowerCase(), t("account.delete.mismatch")),
  })
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { confirm: "" },
  })
  const del = useMutation({
    mutationFn: (confirm: string) =>
      unwrap(api.POST("/v1/account/delete", { body: { confirm: confirm.trim() } })),
    onSuccess: async (res) => {
      invalidateCsrfToken()
      qc.clear()
      await navigate({ to: "/deletion-scheduled", search: { at: res.delete_at }, replace: true })
    },
    onError: (e) => {
      const err = toGezcezError(e)
      if (err.code === "VALIDATION_FAILED")
        form.setError("confirm", { message: t("account.delete.mismatch") })
      else handle(err)
    },
  })
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
  const err = del.error ? toGezcezError(del.error) : null

  return (
    <AccountPage title={t("account.delete.title")} lead={t("account.delete.lead")}>
      {profile.data.deletion ? (
        <Alert
          tone="error"
          action={
            <Button size="sm" loading={cancel.isPending} onClick={() => cancel.mutate()}>
              {t("account.delete.cancel")}
            </Button>
          }
        >
          {t("account.delete.pending", { date: formatDate(profile.data.deletion.delete_at) })}
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Section title={t("account.delete.deletedTitle")} id="deleted">
          <ul className="space-y-2">
            {DELETED.map((k) => (
              <li key={k} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                {t(`account.delete.deleted.${k}` as TKey)}
              </li>
            ))}
          </ul>
        </Section>
        <Section title={t("account.delete.keptTitle")} id="kept">
          <p className="flex items-start gap-2 text-sm">
            <Shield className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("account.delete.kept.audit")}
          </p>
        </Section>
      </div>
      {!profile.data.deletion ? (
        <Section>
          <form
            noValidate
            className="space-y-5"
            onSubmit={form.handleSubmit((v) => sudo() && del.mutate(v.confirm))}
          >
            <Field
              label={t("account.delete.confirmLabel")}
              hint={t("account.delete.confirmHint", { email })}
              error={form.formState.errors.confirm?.message}
            >
              <Input
                type="email"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                {...form.register("confirm")}
              />
            </Field>
            {err && err.code !== "VALIDATION_FAILED" ? <FormError error={err} /> : null}
            <Button type="submit" variant="destructive" loading={del.isPending}>
              {t("account.delete.submit")}
            </Button>
          </form>
        </Section>
      ) : null}
    </AccountPage>
  )
}
