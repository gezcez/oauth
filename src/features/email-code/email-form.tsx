import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useRef, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import type { EmailFlow, EmailIntent } from "@/api/schema"
import { FormError } from "@/components/form-error"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/i18n"
import { flowStore } from "@/lib/flow-memory"
import { Turnstile, type TurnstileAction, type TurnstileHandle } from "@/lib/turnstile"
import { useRateLimit } from "@/lib/use-rate-limit"
import { isGezcezError } from "@/lib/errors"
import { startEmailFlow } from "./api"

/** One email field + Turnstile -> POST email/start. Shared by sign-in, sign-up and reset. */
export function EmailForm({
  intent,
  req,
  defaultEmail,
  submitLabel,
  onStarted,
  footer,
}: {
  intent: Exclude<EmailIntent, "reauth">
  req?: string | undefined
  defaultEmail?: string | undefined
  submitLabel?: string
  onStarted: (flow: EmailFlow, email: string) => void | Promise<void>
  footer?: ReactNode
}) {
  const { t, locale, formatDuration } = useI18n()
  const turnstile = useRef<TurnstileHandle>(null)
  const rate = useRateLimit()
  const schema = z.object({
    email: z
      .string()
      .trim()
      .min(1, t("auth.email.requiredError"))
      .email(t("auth.email.invalid"))
      .max(254, t("auth.email.invalid")),
  })
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: defaultEmail ?? flowStore.lastEmail() },
  })
  const action: TurnstileAction = intent === "reset" ? "reset" : intent === "signup" ? "signup" : "signin"

  const start = useMutation({
    mutationFn: async (email: string) => {
      const token = await turnstile.current?.getToken()
      return startEmailFlow({
        email,
        intent,
        locale,
        ...(req ? { request_id: req } : {}),
        ...(token ? { turnstile_token: token } : {}),
      })
    },
    onSuccess: async (flow, email) => {
      flowStore.save({ ...flow, email, intent })
      await onStarted(flow, email)
    },
    onError: (err) => {
      rate.track(err)
      turnstile.current?.reset()
      if (isGezcezError(err) && err.code === "VALIDATION_FAILED")
        form.setError("email", { message: t("auth.email.invalid") })
    },
  })

  const onSubmit = form.handleSubmit((v) => start.mutate(v.email))
  const fieldError = form.formState.errors.email?.message
  const showSummary = start.error && !(isGezcezError(start.error) && start.error.code === "VALIDATION_FAILED")

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5">
      <Field label={t("auth.email.label")} error={fieldError}>
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          {...form.register("email")}
        />
      </Field>
      <Turnstile ref={turnstile} action={action} />
      {/* While limited, the button carries the countdown; the alert does not repeat it. */}
      {rate.limited ? (
        <Alert tone="error">{t("errors.rateLimitedShort")}</Alert>
      ) : showSummary ? (
        <FormError error={start.error} />
      ) : null}
      <Button type="submit" block loading={start.isPending} disabled={rate.limited}>
        {rate.limited
          ? t("auth.rateLimit.button", { time: formatDuration(rate.secondsLeft) })
          : (submitLabel ?? t("common.continue"))}
      </Button>
      {footer}
    </form>
  )
}
