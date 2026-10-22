/**
 * Hand-typed endpoints the backend's openapi.json does not publish yet.
 *
 * Shapes come from backend.md section 7.1 and oauth.md section 4 (snake_case on the wire),
 * aligned with the DTOs in the backend's rewrite branch where they already exist
 * (src/services/account/account.dto.ts). Each entry says where it stands:
 *
 *   [backend: in progress]  controller exists on the backend rewrite branch, not in openapi.json yet
 *   [backend: missing]      not implemented in the backend yet
 *   [backend: not in plan]  needed by this UI but not in backend.md 7.1 (see README "Backend gaps")
 *   [backend: passkeys]     P5 passkeys, typed by hand from backend.md 7.1 and oauth.md 4.3/4.4 while
 *                           the backend's rewrite-passkeys branch is being built; check these first
 *                           when that branch lands in openapi.json
 *
 * When `bun run api:gen` starts producing a path, delete it here: ./schema.ts merges both and
 * the generated type wins at compile time if the shapes disagree.
 */
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser"
import type { components } from "./schema.gen"

export type ErrorCode = components["schemas"]["ErrorCode"]
export type ApiErrorBody = components["schemas"]["ApiError"]

type Headers = { [name: string]: unknown }
type ErrRes = { headers: Headers; content: { "application/json": components["schemas"]["ErrorResponse"] } }
type OkRes<T> = { headers: Headers; content: { "application/json": { ok: true; data: T } } }

type NoParams = { query?: never; header?: never; path?: never; cookie?: never }
type PathParams<P> = { query?: never; header?: never; path: P; cookie?: never }

type Read<Res, Par = NoParams> = {
  parameters: Par
  requestBody?: never
  responses: { 200: OkRes<Res>; default: ErrRes }
}
type Write<Res, Body = undefined, Par = NoParams, S extends 200 | 201 | 202 = 200> = {
  parameters: Par
  responses: { [K in S]: OkRes<Res> } & { default: ErrRes }
} & ([Body] extends [undefined]
  ? { requestBody?: never }
  : { requestBody: { content: { "application/json": Body } } })
type Methods = "get" | "put" | "post" | "delete" | "options" | "head" | "patch" | "trace"
type Item<M extends Partial<Record<Methods, unknown>>> = Omit<
  { parameters: NoParams } & { [K in Methods]?: never },
  keyof M
> &
  M

// ---------- shared shapes ----------

export type Locale = "tr" | "en"
export type Amr = "otp" | "pwd" | "webauthn"
export type Next = "redirect" | "login" | "reauth" | "choose_account" | "consent"

export interface AccountSummary {
  id: string
  display_name: string
  email_masked: string
  /** Only for the active session. */
  email?: string
  avatar_initials: string
  locale: Locale
}

export interface SessionInfo {
  account: AccountSummary
  session: { id: string; auth_time: string; amr: Amr[]; expires_at: string }
}

export interface DeviceAccount {
  session_id: string
  account: AccountSummary
  active: boolean
  signed_out: boolean
}

export interface ClientInfo {
  client_id: string
  name: string
  logo_url?: string | null
  homepage_url?: string | null
  first_party: boolean
  type: "public" | "confidential"
}

export interface ScopeInfo {
  key: string
  i18n_key: string
}

export interface AuthRequestSnapshot {
  request_id: string
  client: ClientInfo
  scopes: ScopeInfo[]
  prompt?: string | null
  login_hint?: string | null
  ui_locales?: string | null
  next: Next
  redirect_to?: string | null
}

export type EmailIntent = "signin" | "signup" | "reauth" | "reset"

export interface EmailFlow {
  flow_id: string
  expires_at: string
  resend_available_at: string
  code_length: 6
}

export type EmailVerifyResult =
  | { status: "signed_in"; account: AccountSummary; auth_time?: string }
  | { status: "needs_profile"; profile_token: string; email?: string }
  | { status: "reset_ready"; reset_token: string }

export interface Profile {
  id: string
  display_name: string
  email: string
  email_verified_at: string | null
  locale: Locale
  created_at: string
  has_password: boolean
  passkey_count: number
  deletion?: { delete_at: string } | null
}

export interface SessionEntry {
  id: string
  current: boolean
  device: { label: string; os?: string | null; browser?: string | null; kind: "desktop" | "mobile" | "app" }
  approx_location?: string | null
  created_at: string
  last_seen_at: string
  amr: Amr[]
  apps: { client_id: string; name: string }[]
}

export interface ConnectedApp {
  client_id: string
  name: string
  logo_url?: string | null
  first_party: boolean
  scopes: ScopeInfo[]
  granted_at: string
  last_used_at?: string | null
  active_sessions: number
}

export interface SecurityEvent {
  type: string
  at: string
  device_label?: string | null
  approx_location?: string | null
}

export interface Passkey {
  id: string
  name: string
  created_at: string
  last_used_at?: string | null
  /** Backend's guess at where the passkey lives ("iCloud Keychain", "Google Password Manager"). */
  device_hint?: string | null
}

export interface SecurityOverview {
  has_password: boolean
  password_updated_at?: string | null
  passkeys: Passkey[]
  recent_events: SecurityEvent[]
}

/** WebAuthn options as JSON (what @simplewebauthn/server generates) plus the backend's challenge id. */
export type PasskeyRequestOptions = PublicKeyCredentialRequestOptionsJSON & { challenge_id: string }
export type PasskeyCreationOptions = PublicKeyCredentialCreationOptionsJSON & { challenge_id: string }
export type PasskeyAssertion = AuthenticationResponseJSON
export type PasskeyAttestation = RegistrationResponseJSON

export interface PrivacySettings {
  location_history_opt_in: boolean
  product_emails: boolean
}

export interface DataExport {
  id: string
  status: "queued" | "ready" | "expired"
  created_at: string
  expires_at?: string | null
  size_bytes?: number | null
}

type Empty = Record<string, never>

// ---------- paths ----------

export interface paths {
  /** [backend: in progress] */
  "/v1/account/csrf": Item<{ get: Read<{ token: string }> }>
  /** [backend: in progress] */
  "/v1/account/session": Item<{ get: Read<SessionInfo> }>
  /** [backend: in progress] */
  "/v1/account/device-accounts": Item<{ get: Read<{ accounts: DeviceAccount[] }> }>
  /** [backend: not in plan] forget a signed-out account remembered on this device (chooser "Remove") */
  "/v1/account/device-accounts/{sessionId}": Item<{
    delete: Write<Empty, undefined, PathParams<{ sessionId: string }>>
  }>
  /** [backend: in progress] */
  "/v1/account/session/switch": Item<{ post: Write<{ account: AccountSummary }, { session_id: string }> }>
  /** [backend: in progress] */
  "/v1/account/email/start": Item<{
    post: Write<
      EmailFlow,
      { email?: string; intent: EmailIntent; request_id?: string; turnstile_token?: string; locale: Locale },
      NoParams,
      202
    >
  }>
  /** [backend: in progress] */
  "/v1/account/email/resend": Item<{
    post: Write<
      { resend_available_at: string; expires_at: string },
      { flow_id: string; turnstile_token?: string }
    >
  }>
  /** [backend: in progress] */
  "/v1/account/email/verify": Item<{ post: Write<EmailVerifyResult, { flow_id: string; code: string }> }>
  /** [backend: in progress] */
  "/v1/account/signup/complete": Item<{
    post: Write<
      { account: AccountSummary },
      {
        profile_token: string
        display_name: string
        tos_version: string
        privacy_version: string
        locale: Locale
      }
    >
  }>
  /** [backend: missing] */
  "/v1/account/password/login": Item<{
    post: Write<
      { account: AccountSummary },
      { email: string; password: string; request_id?: string; turnstile_token?: string }
    >
  }>
  /** [backend: missing] */
  "/v1/account/password/reset": Item<{
    post: Write<{ account: AccountSummary }, { reset_token: string; new_password: string }>
  }>
  /** [backend: missing] */
  "/v1/account/reauth": Item<{ post: Write<{ auth_time: string }, { password: string }> }>
  /** [backend: missing] */
  "/v1/account/profile": Item<{
    get: Read<Profile>
    patch: Write<Profile, { display_name?: string; locale?: Locale }>
  }>
  /** [backend: missing] sudo */
  "/v1/account/email/change": Item<{
    post: Write<
      Omit<EmailFlow, "code_length">,
      { new_email: string; turnstile_token?: string },
      NoParams,
      202
    >
  }>
  /** [backend: missing] sudo */
  "/v1/account/email/change/verify": Item<{
    post: Write<{ email: string }, { flow_id: string; code: string }>
  }>
  /** [backend: missing] */
  "/v1/account/sessions": Item<{ get: Read<{ sessions: SessionEntry[] }> }>
  /** [backend: missing] */
  "/v1/account/sessions/{sessionId}": Item<{
    delete: Write<Empty, undefined, PathParams<{ sessionId: string }>>
  }>
  /** [backend: missing] sudo */
  "/v1/account/sessions/revoke-others": Item<{ post: Write<{ revoked: number }> }>
  /** [backend: missing] */
  "/v1/account/apps": Item<{ get: Read<{ apps: ConnectedApp[] }> }>
  /** [backend: missing] */
  "/v1/account/apps/{clientId}": Item<{ delete: Write<Empty, undefined, PathParams<{ clientId: string }>> }>
  /** [backend: missing] */
  "/v1/account/security": Item<{ get: Read<SecurityOverview> }>
  /** [backend: missing] sudo */
  "/v1/account/password": Item<{
    put: Write<Empty, { new_password: string; keep_sessions?: boolean }>
    delete: Write<Empty>
  }>
  /** [backend: passkeys] sign-in step 1. Discoverable credentials, so allowCredentials is empty. */
  "/v1/account/passkeys/signin/options": Item<{
    post: Write<PasskeyRequestOptions, { request_id?: string }>
  }>
  /** [backend: passkeys] sign-in step 2. Sets gz_session like email/verify. */
  "/v1/account/passkeys/signin/verify": Item<{
    post: Write<{ account: AccountSummary }, { challenge_id: string; credential: PasskeyAssertion }>
  }>
  /** [backend: passkeys] sudo, registration step 1 */
  "/v1/account/passkeys/options": Item<{ post: Write<PasskeyCreationOptions> }>
  /** [backend: passkeys] sudo, registration step 2 */
  "/v1/account/passkeys": Item<{
    post: Write<
      Passkey,
      { challenge_id: string; credential: PasskeyAttestation; name: string },
      NoParams,
      201
    >
  }>
  /** [backend: passkeys] sudo, rename and remove */
  "/v1/account/passkeys/{passkeyId}": Item<{
    patch: Write<Passkey, { name: string }, PathParams<{ passkeyId: string }>>
    delete: Write<Empty, undefined, PathParams<{ passkeyId: string }>>
  }>
  /** [backend: missing] */
  "/v1/account/privacy": Item<{
    get: Read<PrivacySettings>
    patch: Write<PrivacySettings, Partial<PrivacySettings>>
  }>
  /** [backend: missing] POST is sudo */
  "/v1/account/export": Item<{
    get: Read<{ exports: DataExport[] }>
    post: Write<{ export_id: string; status: "queued" }, undefined, NoParams, 202>
  }>
  /** [backend: missing] */
  "/v1/account/export/{exportId}": Item<{ get: Read<DataExport, PathParams<{ exportId: string }>> }>
  /** [backend: missing] sudo, streamed zip (fetched as a blob, not through this client) */
  "/v1/account/export/{exportId}/download": Item<{ get: Read<never, PathParams<{ exportId: string }>> }>
  /** [backend: missing] sudo */
  "/v1/account/delete": Item<{ post: Write<{ delete_at: string }, { confirm: string }> }>
  /** [backend: missing] */
  "/v1/account/delete/cancel": Item<{ post: Write<Empty> }>

  /** [backend: missing] */
  "/v1/oauth/authorize": Item<{ post: Write<AuthRequestSnapshot, { params: Record<string, string> }> }>
  /** [backend: missing] */
  "/v1/oauth/authorize/{requestId}": Item<{
    get: Read<AuthRequestSnapshot, PathParams<{ requestId: string }>>
  }>
  /** [backend: missing] */
  "/v1/oauth/authorize/{requestId}/continue": Item<{
    post: Write<
      { next: Next; redirect_to?: string | null },
      { session_id?: string },
      PathParams<{ requestId: string }>
    >
  }>
  /** [backend: missing] deny must also work without a session (banned page "Back to app") */
  "/v1/oauth/authorize/{requestId}/decision": Item<{
    post: Write<{ redirect_to: string }, { decision: "approve" | "deny" }, PathParams<{ requestId: string }>>
  }>
  /** [backend: missing] */
  "/v1/oauth/logout": Item<{
    post: Write<
      { redirect_to?: string | null },
      { scope: "session" | "device"; client_id?: string; post_logout_redirect_uri?: string; state?: string }
    >
  }>
}
