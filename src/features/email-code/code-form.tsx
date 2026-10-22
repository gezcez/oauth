import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import type { EmailVerifyResult } from "@/api/schema"
import { FormError } from "@/components/form-error"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { OtpInput } from "@/components/ui/otp-input"
import { useI18n } from "@/i18n"
import { isGezcezError, toGezcezError } from "@/lib/errors"
import { flowStore, secretStore } from "@/lib/flow-memory"
import { Turnstile, type TurnstileHandle } from "@/lib/turnstile"
import { useCountdown } from "@/lib/use-countdown"
import { useErrorMessage } from "@/lib/use-api-error"
import { useRateLimit } from "@/lib/use-rate-limit"
import { resendEmailCode, verifyEmailCode } from "./api"

type VerifyFn = (body: { flow_id: string; code: string }) => Promise<EmailVerifyResult | { email: string }>

/**
 * Six-digit code step shared by sign-in, sign-up, reset, re-auth and email change.
 * Auto-submits on the sixth digit; wrong code shakes, clears and refocuses; expired or
 * too-many-tries offers "Send a new code"; resend waits for `resend_available_at`.
 */
export function CodeForm<R = EmailVerifyResult>({
  flowId,
  req,
  onVerified,
  verify = verifyEmailCode as unknown as VerifyFn,
  footer,
  codeLength = 6,
}: {
  flowId: string
  req?: string | undefined
  onVerified: (result: R) => void | Promise<void>
  verify?: VerifyFn
  footer?: ReactNode
  codeLength?: number
}) {
  const { t, formatDuration } = useI18n()
  const navigate = useNavigate()
  const message = useErrorMessage()
  const [code, setCode] = useState("")
  const [shake, setShake] = useState(false)
  const [formatError, setFormatError] = useState<string | null>(null)
  const [resentNotice, setResentNotice] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const turnstile = useRef<TurnstileHandle>(null)
  const rate = useRateLimit()
  const meta = flowStore.get(flowId)
  const [resendAt, setResendAt] = useState<number | null>(() =>
    meta?.resend_available_at ? new Date(meta.resend_available_at).getTime() : null,
  )
  const resendIn = useCountdown(resendAt)
  const errorId = useId()

  const verifyM = useMutation({
    mutationFn: (value: string) => verify({ flow_id: flowId, code: value }),
    onSuccess: async (res) => {
      flowStore.remove(flowId)
      await onVerified(res as R)
    },
    onError: (e) => {
      const err = toGezcezError(e)
      if (rate.track(err)) return
      if (err.code === "USER_BANNED") {
        secretStore.set("banned", err.details)
        void navigate({ to: "/banned", search: { req }, replace: true })
        return
      }
      if (err.code === "USER_PENDING_DELETION") {
        secretStore.set("pendingDeletion", err.details)
        void navigate({ to: "/pending-deletion", search: { req }, replace: true })
        return
      }
      if (err.code === "AUTH_CODE_INVALID") {
        setCode("")
        setShake(true)
        setTimeout(() => setShake(false), 450)
        requestAnimationFrame(() => inputRef.current?.focus())
      }
    },
  })

  const resendM = useMutation({
    mutationFn: async () => {
      const token = await turnstile.current?.getToken()
      return resendEmailCode({ flow_id: flowId, ...(token ? { turnstile_token: token } : {}) })
    },
    onSuccess: (res) => {
      flowStore.update(flowId, res)
      setResendAt(new Date(res.resend_available_at).getTime())
      setCode("")
      setResentNotice(true)
      verifyM.reset()
      requestAnimationFrame(() => inputRef.current?.focus())
    },
    onError: (e) => {
      const err = toGezcezError(e)
      if (err.code === "RATE_LIMITED" && typeof err.details.retry_after === "number") {
        setResendAt(Date.now() + err.details.retry_after * 1000)
      }
      turnstile.current?.reset()
    },
  })

  useEffect(() => {
    if (!resentNotice) return
    const id = setTimeout(() => setResentNotice(false), 6000)
    return () => clearTimeout(id)
  }, [resentNotice])

  const submit = (value: string) => {
    setFormatError(null)
    if (!new RegExp(`^\\d{${codeLength}}$`).test(value)) {
      setFormatError(t("auth.code.invalidFormat", { length: codeLength }))
      inputRef.current?.focus()
      return
    }
    if (verifyM.isPending || rate.limited) return
    verifyM.mutate(value)
  }

  const err = verifyM.error ? toGezcezError(verifyM.error) : null
  const needsNewCode = err && (err.code === "AUTH_CODE_EXPIRED" || err.code === "AUTH_CODE_ATTEMPTS")
  const inlineCodeError = err && err.code === "AUTH_CODE_INVALID" ? message(err) : formatError
  const otherError =
    err &&
    !needsNewCode &&
    err.code !== "AUTH_CODE_INVALID" &&
    err.code !== "RATE_LIMITED" &&
    err.code !== "USER_BANNED" &&
    err.code !== "USER_PENDING_DELETION"
      ? err
      : null

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        submit(code)
      }}
      className="space-y-5"
    >
      {needsNewCode ? (
        <Alert
          tone="error"
          action={
            <Button
              size="md"
              loading={resendM.isPending}
              onClick={() => resendM.mutate()}
              disabled={resendIn > 0}
            >
              {resendIn > 0
                ? t("auth.rateLimit.button", { time: formatDuration(resendIn) })
                : t("auth.code.sendNew")}
            </Button>
          }
        >
          {message(err)}
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`${errorId}-otp`}>{t("auth.code.label")}</Label>
        <OtpInput
          id={`${errorId}-otp`}
          ref={inputRef}
          value={code}
          onChange={(v) => {
            setCode(v)
            if (formatError) setFormatError(null)
          }}
          onComplete={submit}
          length={codeLength}
          invalid={Boolean(inlineCodeError)}
          shake={shake}
          disabled={Boolean(needsNewCode)}
          autoFocus
          aria-invalid={inlineCodeError ? true : undefined}
          aria-describedby={inlineCodeError ? `${errorId}-err ${errorId}-help` : `${errorId}-help`}
        />
        {inlineCodeError ? (
          <p id={`${errorId}-err`} role="alert" className="text-sm text-danger">
            {inlineCodeError}
          </p>
        ) : null}
        <p id={`${errorId}-help`} className="text-sm text-subtle">
          {t("auth.code.help")}
        </p>
      </div>

      {resentNotice ? <Alert tone="success">{t("auth.code.resent")}</Alert> : null}
      {otherError ? <FormError error={otherError} /> : null}
      {resendM.error && !(isGezcezError(resendM.error) && resendM.error.code === "RATE_LIMITED") ? (
        <FormError error={resendM.error} />
      ) : null}

      <Turnstile ref={turnstile} action="resend" />

      <Button
        type="submit"
        block
        loading={verifyM.isPending}
        disabled={rate.limited || Boolean(needsNewCode)}
      >
        {rate.limited
          ? t("auth.rateLimit.button", { time: formatDuration(rate.secondsLeft) })
          : t("common.continue")}
      </Button>

      {!needsNewCode ? (
        <p className="text-sm text-muted">
          {resendIn > 0 ? (
            <span aria-live={resendIn <= 1 ? "polite" : "off"}>
              {t("auth.code.resendIn", { time: formatDuration(resendIn) })}
            </span>
          ) : (
            <>
              {t("auth.code.resendPrompt")}{" "}
              <Button variant="link" onClick={() => resendM.mutate()} loading={resendM.isPending}>
                {t("auth.code.resend")}
              </Button>
            </>
          )}
        </p>
      ) : null}
      {footer}
    </form>
  )
}
