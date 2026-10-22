import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { api, unwrap } from "@/api/client"
import { profileQuery } from "@/api/queries"
import { FormError } from "@/components/form-error"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { AccountPage, LoadError, Loading, Section } from "@/features/account/page"
import { useSudo } from "@/features/account/use-sudo"
import { CodeForm } from "@/features/email-code/code-form"
import { useI18n } from "@/i18n"
import { isGezcezError, toGezcezError } from "@/lib/errors"
import { flowStore } from "@/lib/flow-memory"
import { Turnstile, type TurnstileHandle } from "@/lib/turnstile"
import { useHandleApiError } from "@/lib/use-api-error"
import { useRateLimit } from "@/lib/use-rate-limit"

export const Route = createFileRoute("/account/email")({
  component: EmailPage,
})

type Step =
  | { kind: "view" }
  | { kind: "form" }
  | { kind: "code"; flowId: string; email: string }
  | { kind: "done"; email: string }

function EmailPage() {
  const { t } = useI18n()
  const profile = useQuery(profileQuery)
  const qc = useQueryClient()
  const sudo = useSudo()
  const handle = useHandleApiError()
  const [step, setStep] = useState<Step>({ kind: "view" })
  if (profile.isPending) return <Loading />
  if (profile.error) return <LoadError error={profile.error} retry={() => void profile.refetch()} />
  const current = profile.data.email
  return (
    <AccountPage title={t("account.email.title")} lead={t("account.email.lead")}>
      {step.kind === "done" ? (
        <Alert tone="success">{t("account.email.done", { email: step.email })}</Alert>
      ) : null}
      <Section>
        <dl className="space-y-1">
          <dt className="text-sm font-semibold text-muted">{t("account.email.current")}</dt>
          <dd className="text-lg font-semibold break-all">{current}</dd>
        </dl>
        {step.kind === "view" || step.kind === "done" ? (
          <Button variant="secondary" onClick={() => sudo() && setStep({ kind: "form" })}>
            {t("account.email.change")}
          </Button>
        ) : null}
      </Section>
      {step.kind === "form" ? (
        <Section title={t("account.email.change")}>
          <NewEmailForm
            current={current}
            onStarted={(flowId, email) => setStep({ kind: "code", flowId, email })}
            onCancel={() => setStep({ kind: "view" })}
          />
        </Section>
      ) : null}
      {step.kind === "code" ? (
        <Section
          title={t("account.email.codeTitle")}
          description={t("account.email.codeLead", { email: step.email })}
        >
          <CodeForm<{ email: string }>
            flowId={step.flowId}
            verify={async (b) => {
              try {
                return await unwrap(api.POST("/v1/account/email/change/verify", { body: b }))
              } catch (e) {
                if (handle(e)) return new Promise<never>(() => {})
                throw e
              }
            }}
            onVerified={async (res) => {
              await qc.invalidateQueries({ queryKey: ["account"] })
              setStep({ kind: "done", email: res.email })
            }}
            footer={
              <Button variant="link" onClick={() => setStep({ kind: "form" })}>
                {t("auth.code.differentEmail")}
              </Button>
            }
          />
        </Section>
      ) : null}
    </AccountPage>
  )
}

function NewEmailForm({
  current,
  onStarted,
  onCancel,
}: {
  current: string
  onStarted: (flowId: string, email: string) => void
  onCancel: () => void
}) {
  const { t, formatDuration } = useI18n()
  const handle = useHandleApiError()
  const turnstile = useRef<TurnstileHandle>(null)
  const rate = useRateLimit()
  const schema = z.object({
    new_email: z
      .string()
      .trim()
      .min(1, t("auth.email.requiredError"))
      .email(t("auth.email.invalid"))
      .refine((v) => v.toLowerCase() !== current.toLowerCase(), t("account.email.sameAsCurrent")),
  })
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { new_email: "" },
  })
  const m = useMutation({
    mutationFn: async (email: string) => {
      const token = await turnstile.current?.getToken()
      return unwrap(
        api.POST("/v1/account/email/change", {
          body: { new_email: email, ...(token ? { turnstile_token: token } : {}) },
        }),
      )
    },
    onSuccess: (flow, email) => {
      flowStore.save({ ...flow, code_length: 6, email, intent: "signin" })
      onStarted(flow.flow_id, email)
    },
    onError: (e) => {
      turnstile.current?.reset()
      if (rate.track(e)) return
      const err = toGezcezError(e)
      if (err.code === "VALIDATION_FAILED") form.setError("new_email", { message: t("auth.email.invalid") })
      else if (err.code === "EMAIL_TAKEN") form.setError("new_email", { message: t("errors.EMAIL_TAKEN") })
      else handle(err)
    },
  })
  const err =
    m.error &&
    isGezcezError(m.error) &&
    ![
      "VALIDATION_FAILED",
      "EMAIL_TAKEN",
      "RATE_LIMITED",
      "AUTH_STEP_UP_REQUIRED",
      "AUTH_SESSION_REQUIRED",
    ].includes(m.error.code)
      ? m.error
      : null
  return (
    <form noValidate className="space-y-5" onSubmit={form.handleSubmit((v) => m.mutate(v.new_email))}>
      <Field label={t("account.email.newLabel")} error={form.formState.errors.new_email?.message}>
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          {...form.register("new_email")}
        />
      </Field>
      <Turnstile ref={turnstile} action="email_change" />
      {err ? <FormError error={err} /> : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" loading={m.isPending} disabled={rate.limited}>
          {rate.limited
            ? t("auth.rateLimit.button", { time: formatDuration(rate.secondsLeft) })
            : t("account.email.sendCode")}
        </Button>
      </div>
    </form>
  )
}
