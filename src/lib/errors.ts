import type { ErrorCode } from "@/api/schema"

/** Codes from the backend's ErrorCode enum plus two client-side ones. */
export type ClientErrorCode = ErrorCode | "NETWORK" | "UNKNOWN"

export interface ErrorDetails {
  retry_after?: number
  attempts_left?: number
  max_age?: number
  fields?: Record<string, string | string[]>
  reasons?: string[]
  public_reason?: string | null
  since?: string | null
  until?: string | null
  delete_at?: string | null
  ref?: string
  [key: string]: unknown
}

export class GezcezError extends Error {
  readonly code: ClientErrorCode
  readonly status: number
  readonly details: ErrorDetails
  readonly requestId: string | undefined

  constructor(
    code: ClientErrorCode,
    opts: { message?: string; status?: number; details?: ErrorDetails; requestId?: string } = {},
  ) {
    super(opts.message ?? code)
    this.name = "GezcezError"
    this.code = code
    this.status = opts.status ?? 0
    this.details = opts.details ?? {}
    this.requestId = opts.requestId
  }

  /** Support reference: the backend request id, or the `ref` the OAuth error page shows. */
  get reference(): string | undefined {
    return this.details.ref ?? this.requestId
  }
}

export function isGezcezError(e: unknown): e is GezcezError {
  return e instanceof GezcezError
}

export function toGezcezError(e: unknown): GezcezError {
  if (isGezcezError(e)) return e
  if (e instanceof TypeError) return new GezcezError("NETWORK", { message: e.message })
  return new GezcezError("UNKNOWN", { message: e instanceof Error ? e.message : String(e) })
}

/**
 * How the UI reacts to a code (oauth.md section 7.6):
 * - inline: message next to the form that caused it
 * - page: a full page (error page, banned page, pending deletion page)
 * - toast: generic toast with the support reference
 * - signin: session gone; go to /signin?return=... with an info toast
 * - reauth: step-up needed; go to /reauth?return=...
 * - silent: handled by the fetch wrapper (CSRF retry)
 */
export type ErrorBehaviour = "inline" | "page" | "toast" | "signin" | "reauth" | "silent"

export const errorBehaviour: Record<ClientErrorCode, ErrorBehaviour> = {
  VALIDATION_FAILED: "inline",
  AUTH_REQUIRED: "signin",
  AUTH_SESSION_REQUIRED: "signin",
  AUTH_TOKEN_INVALID: "inline",
  AUTH_TOKEN_EXPIRED: "inline",
  AUTH_SESSION_REVOKED: "signin",
  AUTH_CODE_INVALID: "inline",
  AUTH_CODE_EXPIRED: "inline",
  AUTH_CODE_ATTEMPTS: "inline",
  AUTH_PASSWORD_INVALID: "inline",
  AUTH_PASSWORD_WEAK: "inline",
  AUTH_PASSWORD_BREACHED: "inline",
  AUTH_TURNSTILE_FAILED: "inline",
  AUTH_STEP_UP_REQUIRED: "reauth",
  CSRF_INVALID: "silent",
  OAUTH_INVALID_CLIENT: "page",
  OAUTH_INVALID_REDIRECT_URI: "page",
  OAUTH_REQUEST_EXPIRED: "page",
  OAUTH_REQUEST_NOT_FOUND: "page",
  SCOPE_MISSING: "toast",
  PERMISSION_MISSING: "toast",
  ROLE_LEVEL_TOO_LOW: "toast",
  ROLE_IMMUTABLE: "toast",
  USER_BANNED: "page",
  USER_PENDING_DELETION: "page",
  USER_DELETED: "inline",
  EMAIL_TAKEN: "inline",
  USERNAME_TAKEN: "inline",
  NOT_FOUND: "toast",
  CONFLICT: "toast",
  VERSION_CONFLICT: "toast",
  RATE_LIMITED: "inline",
  PROVIDER_DISABLED: "toast",
  PROVIDER_UNAVAILABLE: "toast",
  CAPABILITY_UNSUPPORTED: "toast",
  CARD_NOT_FOUND: "toast",
  ANALYTICS_TIMEOUT: "toast",
  INTERNAL: "toast",
  NETWORK: "inline",
  UNKNOWN: "toast",
}

/** OAuth errors that must never redirect back to the client (RFC 6749 4.1.2.1). */
export const NON_REDIRECTABLE_OAUTH_ERRORS = [
  "OAUTH_INVALID_CLIENT",
  "OAUTH_INVALID_REDIRECT_URI",
  "OAUTH_REQUEST_EXPIRED",
  "OAUTH_REQUEST_NOT_FOUND",
] as const satisfies readonly ErrorCode[]

export type OAuthPageErrorCode = (typeof NON_REDIRECTABLE_OAUTH_ERRORS)[number]

export function isOAuthPageError(code: string): code is OAuthPageErrorCode {
  return (NON_REDIRECTABLE_OAUTH_ERRORS as readonly string[]).includes(code)
}

export function isServerError(e: GezcezError): boolean {
  return e.status >= 500 || e.code === "INTERNAL" || e.code === "UNKNOWN"
}
