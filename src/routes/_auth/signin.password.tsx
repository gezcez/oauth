import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useRef } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { AuthHeader } from "@/components/auth-header"
import { FormError } from "@/components/form-error"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ClientEyebrow } from "@/features/authorize/client-eyebrow"
import { passwordLogin } from "@/features/password/api"
import { PasswordInput } from "@/features/password/password-input"
import { useAfterSignIn } from "@/features/session/after-signin"
import { useAuthRequest } from "@/features/session/use-auth-request"
import { useI18n } from "@/i18n"
import { isGezcezError, toGezcezError } from "@/lib/errors"
import { flowStore, secretStore } from "@/lib/flow-memory"
import { authSearch } from "@/lib/search"
import { Turnstile, type TurnstileHandle } from "@/lib/turnstile"
import { useRateLimit } from "@/lib/use-rate-limit"

export const Route = createFileRoute("/_auth/signin/password")({
  validateSearch: authSearch,
  component: PasswordPage,
})

function PasswordPage() {
  const { req, return: returnTo } = Route.useSearch()
  const { t, formatDuration } = useI18n()
  const navigate = useNavigate()
  const request = useAuthRequest(req)
  const after = useAfterSignIn()
  const turnstile = useRef<TurnstileHandle>(null)
  const rate = useRateLimit()
  const schema = z.object({
    email: z.string().trim().min(1, t("auth.email.requiredError")).email(t("auth.email.invalid")),
    password: z.string().min(1, t("auth.password.requiredError")),
  })
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: request.data?.login_hint ?? flowStore.lastEmail(), password: "" },
  })

  const login = useMutation({
    mutationFn: async (v: z.infer<typeof schema>) => {
      const token = await turnstile.current?.getToken()
      flowStore.setLastEmail(v.email)
      return passwordLogin({
        email: v.email,
        password: v.password,
        ...(req ? { request_id: req } : {}),
        ...(token ? { turnstile_token: token } : {}),
      })
    },
    onSuccess: () => after({ req, returnTo }),
    onError: (e) => {
      const err = toGezcezError(e)
      turnstile.current?.reset()
      if (rate.track(err)) return
      if (err.code === "USER_BANNED") {
        secretStore.set("banned", err.details)
        void navigate({ to: "/banned", search: { req }, replace: true })
      } else if (err.code === "USER_PENDING_DELETION") {
        secretStore.set("pendingDeletion", err.details)
        void navigate({ to: "/pending-deletion", search: { req }, replace: true })
      } else if (err.code === "AUTH_PASSWORD_INVALID") {
        form.setValue("password", "")
        form.setFocus("password")
      }
    },
  })

  const err = login.error ? toGezcezError(login.error) : null
  const isWrong = err?.code === "AUTH_PASSWORD_INVALID"

  return (
    <>
      <ClientEyebrow request={request.data} fallback={t("auth.eyebrow.signin")} />
      <AuthHeader title={t("auth.password.title")} />
      <form noValidate onSubmit={form.handleSubmit((v) => login.mutate(v))} className="space-y-5">
        <Field label={t("auth.email.label")} error={form.formState.errors.email?.message}>
          <Input
            type="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            {...form.register("email")}
          />
        </Field>
        <Field
          label={t("auth.password.label")}
          error={form.formState.errors.password?.message}
          labelAside={
            <Link
              to="/reset"
              search={{ req }}
              className="text-sm font-medium text-link underline-offset-4 hover:underline"
            >
              {t("auth.password.forgot")}
            </Link>
          }
        >
          <PasswordInput
            autoComplete="current-password"
            autoFocus={Boolean(form.getValues("email"))}
            {...form.register("password")}
          />
        </Field>
        <Turnstile ref={turnstile} action="signin" />
        {err &&
        !(isGezcezError(err) && (err.code === "USER_BANNED" || err.code === "USER_PENDING_DELETION")) ? (
          <FormError
            error={err}
            action={
              isWrong || err.code === "RATE_LIMITED" ? (
                <Button asChild variant="secondary" size="sm">
                  <Link to="/signin" search={{ req, return: returnTo }}>
                    {t("auth.password.emailCodeInstead")}
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : null}
        <Button type="submit" block loading={login.isPending} disabled={rate.limited}>
          {rate.limited
            ? t("auth.rateLimit.button", { time: formatDuration(rate.secondsLeft) })
            : t("auth.password.submit")}
        </Button>
        <p className="border-t border-line pt-5 text-sm">
          <Link
            to="/signin"
            search={{ req, return: returnTo }}
            className="font-medium text-link underline-offset-4 hover:underline"
          >
            {t("auth.password.emailCodeInstead")}
          </Link>
        </p>
      </form>
    </>
  )
}
