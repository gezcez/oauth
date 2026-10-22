import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { KeyRound, Mail } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { profileQuery, sessionQuery } from "@/api/queries"
import type { EmailVerifyResult } from "@/api/schema"
import { AuthHeader } from "@/components/auth-header"
import { FormError } from "@/components/form-error"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toaster"
import { startEmailFlow } from "@/features/email-code/api"
import { CodeForm } from "@/features/email-code/code-form"
import { reauthWithPassword } from "@/features/password/api"
import { PasswordInput } from "@/features/password/password-input"
import { AccountChip } from "@/features/session/account-chip"
import { useAfterSignIn } from "@/features/session/after-signin"
import { logout } from "@/features/session/api"
import { useAuthRequest } from "@/features/session/use-auth-request"
import { useI18n } from "@/i18n"
import { invalidateCsrfToken } from "@/lib/csrf"
import { toGezcezError } from "@/lib/errors"
import { flowStore } from "@/lib/flow-memory"
import { authSearch } from "@/lib/search"
import { useRateLimit } from "@/lib/use-rate-limit"

export const Route = createFileRoute("/_auth/reauth")({
  validateSearch: authSearch,
  component: ReauthPage,
})

type Step = { kind: "choose" } | { kind: "code"; flowId: string } | { kind: "password" }

/**
 * Step-up: the account is fixed (no switching here). Strongest method first: passkey (P5),
 * then an email code to the session's address, with password if the account has one.
 */
function ReauthPage() {
  const { req, return: returnTo } = Route.useSearch()
  const { t, locale, formatDuration } = useI18n()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const request = useAuthRequest(req)
  const session = useQuery(sessionQuery)
  const profile = useQuery({ ...profileQuery, enabled: Boolean(session.data) })
  const after = useAfterSignIn()
  const [step, setStep] = useState<Step>({ kind: "choose" })
  const rate = useRateLimit()

  useEffect(() => {
    if (session.isSuccess && !session.data) {
      void navigate({ to: "/signin", search: { req, return: returnTo }, replace: true })
    }
  }, [session.isSuccess, session.data, navigate, req, returnTo])

  const finish = async () => {
    invalidateCsrfToken()
    await qc.invalidateQueries({ queryKey: ["account"] })
    if (!req) toast(t("auth.reauth.done"))
    await after({ req, returnTo: returnTo ?? "/account" })
  }

  const sendCode = useMutation({
    mutationFn: () => startEmailFlow({ intent: "reauth", locale, ...(req ? { request_id: req } : {}) }),
    onSuccess: (flow) => {
      flowStore.save({ ...flow, intent: "reauth" })
      setStep({ kind: "code", flowId: flow.flow_id })
    },
    onError: (e) => rate.track(e),
  })

  const signOut = useMutation({
    mutationFn: () => logout({ scope: "session" }),
    onSuccess: async () => {
      invalidateCsrfToken()
      await qc.invalidateQueries()
      void navigate({ to: "/signin", search: { req, return: returnTo }, replace: true })
    },
  })

  if (session.isPending || !session.data) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label={t("common.loading")} />
      </div>
    )
  }
  const account = session.data.account
  const clientName = request.data?.client.name
  const hasPassword = profile.data?.has_password ?? false

  return (
    <>
      <AuthHeader
        eyebrow={t("auth.eyebrow.reauth")}
        title={t("auth.reauth.title")}
        lead={clientName ? t("auth.reauth.leadClient", { client: clientName }) : t("auth.reauth.leadAccount")}
      />
      <div className="mb-6">
        <AccountChip account={account} />
      </div>

      {step.kind === "choose" ? (
        <div className="space-y-3">
          {sendCode.error && !rate.limited ? <FormError error={sendCode.error} /> : null}
          <Button
            block
            loading={sendCode.isPending}
            disabled={rate.limited}
            onClick={() => sendCode.mutate()}
          >
            <Mail className="size-4" aria-hidden />
            {rate.limited
              ? t("auth.rateLimit.button", { time: formatDuration(rate.secondsLeft) })
              : t("auth.reauth.sendCode", { email: account.email_masked })}
          </Button>
          {hasPassword ? (
            <Button block variant="secondary" onClick={() => setStep({ kind: "password" })}>
              <KeyRound className="size-4" aria-hidden />
              {t("auth.reauth.usePassword")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {step.kind === "code" ? (
        <CodeForm<EmailVerifyResult>
          flowId={step.flowId}
          req={req}
          onVerified={finish}
          footer={
            hasPassword ? (
              <p className="border-t border-line pt-5 text-sm">
                <Button variant="link" onClick={() => setStep({ kind: "password" })}>
                  {t("auth.reauth.usePassword")}
                </Button>
              </p>
            ) : undefined
          }
        />
      ) : null}

      {step.kind === "password" ? (
        <PasswordStep onDone={finish} onUseCode={() => sendCode.mutate()} sending={sendCode.isPending} />
      ) : null}

      <div className="mt-6 border-t border-line pt-5 text-sm">
        <Button variant="link" loading={signOut.isPending} onClick={() => signOut.mutate()}>
          {t("auth.reauth.notYou")}
        </Button>
      </div>
    </>
  )
}

function PasswordStep({
  onDone,
  onUseCode,
  sending,
}: {
  onDone: () => Promise<void>
  onUseCode: () => void
  sending: boolean
}) {
  const { t, formatDuration } = useI18n()
  const rate = useRateLimit()
  const ref = useRef<HTMLInputElement | null>(null)
  const schema = z.object({ password: z.string().min(1, t("auth.password.requiredError")) })
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "" },
  })
  const m = useMutation({
    mutationFn: (pw: string) => reauthWithPassword(pw),
    onSuccess: onDone,
    onError: (e) => {
      if (rate.track(e)) return
      if (toGezcezError(e).code === "AUTH_PASSWORD_INVALID") {
        form.setValue("password", "")
        form.setFocus("password")
      }
    },
  })
  const { ref: regRef, ...reg } = form.register("password")
  return (
    <form noValidate className="space-y-5" onSubmit={form.handleSubmit((v) => m.mutate(v.password))}>
      <Field label={t("auth.password.label")} error={form.formState.errors.password?.message}>
        <PasswordInput
          autoComplete="current-password"
          autoFocus
          ref={(el) => {
            regRef(el)
            ref.current = el
          }}
          {...reg}
        />
      </Field>
      {m.error ? <FormError error={m.error} /> : null}
      <Button type="submit" block loading={m.isPending} disabled={rate.limited}>
        {rate.limited
          ? t("auth.rateLimit.button", { time: formatDuration(rate.secondsLeft) })
          : t("auth.reauth.passwordSubmit")}
      </Button>
      <p className="text-sm">
        <Button variant="link" onClick={onUseCode} loading={sending}>
          {t("auth.reauth.useCode")}
        </Button>
      </p>
    </form>
  )
}
