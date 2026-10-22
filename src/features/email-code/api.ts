import { api, unwrap } from "@/api/client"
import type { EmailIntent, Locale } from "@/api/schema"

export function startEmailFlow(body: {
  email?: string
  intent: EmailIntent
  request_id?: string
  turnstile_token?: string
  locale: Locale
}) {
  return unwrap(api.POST("/v1/account/email/start", { body }))
}

export function resendEmailCode(body: { flow_id: string; turnstile_token?: string }) {
  return unwrap(api.POST("/v1/account/email/resend", { body }))
}

export function verifyEmailCode(body: { flow_id: string; code: string }) {
  return unwrap(api.POST("/v1/account/email/verify", { body }))
}
