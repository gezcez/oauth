/**
 * Named shapes the UI uses, derived from the generated schema, plus hand-typed endpoints the
 * backend's openapi.json does not publish yet. Each hand-typed entry says where it stands:
 *
 *   [backend: missing]      in oauth.md section 4 but not implemented in the backend yet
 *   [backend: not in plan]  needed by this UI but not in backend.md 7.1 (see README "Backend gaps")
 *
 * When `bun run api:gen` starts producing a path, delete it here. Paths must never appear in
 * both files: ./schema.ts intersects them and overlapping response types collapse.
 */
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

// ---------- shared shapes (from the generated schema) ----------

type S = components["schemas"]

export type Locale = S["ProfileDto"]["locale"]
export type Amr = S["SessionInfoDto"]["session"]["amr"][number]
export type Next = S["AuthorizeNextDto"]["next"]
export type AccountSummary = S["AccountResultDto"]["account"]
export type SessionInfo = S["SessionInfoDto"]
export type DeviceAccount = S["DeviceAccountsDto"]["accounts"][number]
export type AuthRequestSnapshot = S["AuthorizeSnapshotDto"]
export type ClientInfo = AuthRequestSnapshot["client"]
export type ScopeInfo = AuthRequestSnapshot["scopes"][number]
export type EmailIntent = S["EmailStartDto"]["intent"]
export type EmailFlow = S["EmailFlowDto"]
export type EmailVerifyResult = S["EmailVerifyResultDto"]
export type Profile = S["ProfileDto"]
export type SessionEntry = S["SessionListDto"]["sessions"][number]
export type ConnectedApp = S["AuthorizedAppsDto"]["apps"][number]
export type SecurityOverview = S["SecurityDto"]
export type SecurityEvent = SecurityOverview["recent_events"][number]
export type PrivacySettings = S["PrivacyDto"]

/** [backend: missing] data export (oauth.md 4.4) */
export interface DataExport {
  id: string
  status: "queued" | "ready" | "expired"
  created_at: string
  expires_at?: string | null
  size_bytes?: number | null
}

type Empty = Record<string, never>

// ---------- paths the backend does not publish yet ----------

export interface paths {
  /** [backend: not in plan] forget a signed-out account remembered on this device (chooser "Remove") */
  "/v1/account/device-accounts/{sessionId}": Item<{
    delete: Write<Empty, undefined, PathParams<{ sessionId: string }>>
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
}
