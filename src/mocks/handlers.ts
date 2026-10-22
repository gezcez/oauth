import { delay, http, HttpResponse, type DefaultBodyType, type StrictRequest } from "msw"
import type { AccountSummary, AuthRequestSnapshot, ErrorCode, Next } from "@/api/schema"
import {
  ADA_PASSWORD,
  CLIENTS,
  CODE_ATTEMPTS,
  CODE_EXPIRED,
  CODE_OK,
  connectedApps,
  getDb,
  mockId,
  newSessionFor,
  saveDb,
  type MockDb,
  type MockSession,
  type MockUser,
} from "./db"

const STATUS: Partial<Record<ErrorCode, number>> = {
  VALIDATION_FAILED: 400,
  AUTH_SESSION_REQUIRED: 401,
  AUTH_CODE_INVALID: 400,
  AUTH_CODE_EXPIRED: 400,
  AUTH_CODE_ATTEMPTS: 400,
  AUTH_PASSWORD_INVALID: 401,
  AUTH_PASSWORD_WEAK: 400,
  AUTH_PASSWORD_BREACHED: 400,
  AUTH_TURNSTILE_FAILED: 400,
  AUTH_STEP_UP_REQUIRED: 403,
  CSRF_INVALID: 403,
  OAUTH_INVALID_CLIENT: 400,
  OAUTH_INVALID_REDIRECT_URI: 400,
  OAUTH_REQUEST_EXPIRED: 410,
  OAUTH_REQUEST_NOT_FOUND: 404,
  USER_BANNED: 403,
  USER_PENDING_DELETION: 403,
  EMAIL_TAKEN: 409,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  INTERNAL: 500,
}

const STEP_UP_S = 600
const REQUEST_TTL = 10 * 60_000
const CODE_TTL = 10 * 60_000
const RESEND_AFTER = 30_000
/** Small artificial latency so loading states are visible in dev:mock. 0 under Vitest. */
const LATENCY = import.meta.env.VITEST ? 0 : 250

function rid(): string {
  return mockId("req")
}

function ok<T>(data: T, status = 200) {
  return HttpResponse.json({ ok: true as const, data }, { status, headers: { "x-request-id": rid() } })
}

function fail(code: ErrorCode, details?: Record<string, unknown>, status?: number) {
  const request_id = rid()
  return HttpResponse.json(
    { ok: false as const, error: { code, message: code, details, request_id } },
    { status: status ?? STATUS[code] ?? 400, headers: { "x-request-id": request_id } },
  )
}

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@")
  return `${local.slice(0, 1)}***@${domain}`
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toLocaleUpperCase("tr"))
      .join("") || "?"
  )
}

function summary(u: MockUser, withEmail: boolean): AccountSummary {
  return {
    id: u.id,
    display_name: u.display_name,
    email_masked: maskEmail(u.email),
    ...(withEmail ? { email: u.email } : {}),
    avatar_initials: initials(u.display_name),
    locale: u.locale,
  }
}

function activeSession(db: MockDb): MockSession | null {
  const s = db.sessions.find((x) => x.id === db.active_session && !x.signed_out)
  return s ?? null
}

function currentUser(db: MockDb): { s: MockSession; u: MockUser } | null {
  const s = activeSession(db)
  if (!s) return null
  const u = db.users.find((x) => x.id === s.user_id)
  return u ? { s, u } : null
}

function csrfToken(db: MockDb): string {
  return `mock-csrf-${db.csrf_seq}`
}

async function body<T>(request: StrictRequest<DefaultBodyType>): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    return {} as T
  }
}

/** Origin + synchronizer token check for writes (backend 6.1.0). */
function checkCsrf(request: Request, db: MockDb) {
  if (request.headers.get("x-csrf-token") !== csrfToken(db)) return fail("CSRF_INVALID")
  return null
}

function requireSession(db: MockDb) {
  const cu = currentUser(db)
  if (!cu) return { error: fail("AUTH_SESSION_REQUIRED") } as const
  cu.s.last_seen_at = new Date().toISOString()
  return { cu } as const
}

function requireSudo(s: MockSession) {
  if (Date.now() - s.auth_time > STEP_UP_S * 1000)
    return fail("AUTH_STEP_UP_REQUIRED", { max_age: STEP_UP_S })
  return null
}

function event(u: MockUser, type: string) {
  u.events.unshift({
    type,
    at: new Date().toISOString(),
    device_label: "Firefox on macOS",
    approx_location: "İstanbul, TR",
  })
  u.events = u.events.slice(0, 20)
}

function emailRateLimited(db: MockDb, email: string): number | null {
  const now = Date.now()
  const list = (db.email_counts[email] ?? []).filter((t) => now - t < 3600_000)
  if (list.length >= 5) return Math.ceil((list[0]! + 3600_000 - now) / 1000)
  list.push(now)
  db.email_counts[email] = list
  return null
}

/** Sign in after proof of ownership; banned and pending-deletion rules as in the backend. */
function signIn(db: MockDb, u: MockUser, amr: "otp" | "pwd") {
  if (u.status === "banned" && u.ban) {
    return { error: fail("USER_BANNED", { ...u.ban }) } as const
  }
  // Re-use this device's session for the same user (backend issues a fresh cookie value).
  const existing = db.sessions.find((s) => s.user_id === u.id && s.on_this_device)
  let s: MockSession
  if (existing) {
    existing.signed_out = false
    existing.auth_time = Date.now()
    existing.amr = [amr]
    db.active_session = existing.id
    db.csrf_seq++
    s = existing
  } else {
    s = newSessionFor(db, u.id, [amr])
  }
  event(u, "auth.login")
  if (u.status === "pending_deletion") {
    return { error: fail("USER_PENDING_DELETION", { delete_at: u.delete_at }) } as const
  }
  return { s } as const
}

// ---------- authorization requests ----------

function requestNext(db: MockDb, ar: MockAuthRequest): { next: Next; redirect_to?: string } {
  const client = CLIENTS.find((c) => c.client_id === ar.client_id)!
  const p = ar.params
  const cu = currentUser(db)
  const prompt = p.prompt ?? ""
  const errorRedirect = (error: string) => ({
    next: "redirect" as const,
    redirect_to: `${p.redirect_uri}?error=${error}&state=${encodeURIComponent(p.state ?? "")}`,
  })
  const live = db.sessions.filter((s) => s.on_this_device && !s.signed_out)
  if (!cu) {
    if (prompt === "none") return errorRedirect("login_required")
    if (live.length > 0 && !ar.chosen_session) return { next: "choose_account" }
    return { next: "login" }
  }
  if (cu.u.status === "banned") return errorRedirect("access_denied")
  const wantsChooser =
    (prompt.includes("select_account") || (live.length > 1 && !p.login_hint)) &&
    ar.chosen_session === undefined
  if (wantsChooser)
    return prompt === "none" ? errorRedirect("account_selection_required") : { next: "choose_account" }
  const maxAge = p.max_age !== undefined ? Number(p.max_age) : undefined
  const loginForced = prompt.includes("login") && cu.s.auth_time < ar.created_at
  const tooOld = maxAge !== undefined && Date.now() - cu.s.auth_time > maxAge * 1000
  if (loginForced || tooOld) return prompt === "none" ? errorRedirect("login_required") : { next: "reauth" }
  const scopes = (p.scope ?? "").split(/\s+/).filter(Boolean)
  if (!client.first_party) {
    const grant = db.grants.find((g) => g.user_id === cu.u.id && g.client_id === client.client_id)
    const covered = grant && scopes.every((sc) => grant.scopes.includes(sc))
    if (!covered || prompt.includes("consent"))
      return prompt === "none" ? errorRedirect("consent_required") : { next: "consent" }
  }
  if (!cu.s.apps.some((a) => a.client_id === client.client_id))
    cu.s.apps.push({ client_id: client.client_id, name: client.name })
  return {
    next: "redirect",
    redirect_to: `${p.redirect_uri}?code=${mockId("code").toLowerCase()}&state=${encodeURIComponent(p.state ?? "")}`,
  }
}

type MockAuthRequest = MockDb["requests"][number]

function snapshot(db: MockDb, ar: MockAuthRequest): AuthRequestSnapshot {
  const client = CLIENTS.find((c) => c.client_id === ar.client_id)!
  const scopes = (ar.params.scope ?? "").split(/\s+/).filter(Boolean)
  const n = requestNext(db, ar)
  return {
    request_id: ar.id,
    client: {
      client_id: client.client_id,
      name: client.name,
      first_party: client.first_party,
      type: client.type,
      homepage_url: client.homepage_url ?? null,
      logo_url: client.logo_url ?? null,
    },
    scopes: scopes.map((key) => ({ key, i18n_key: `scopes.${key}` })),
    prompt: ar.params.prompt ?? null,
    login_hint: ar.params.login_hint ?? null,
    ui_locales: ar.params.ui_locales ?? null,
    next: n.next,
    redirect_to: n.redirect_to ?? null,
  }
}

function findRequest(db: MockDb, id: string) {
  const ar = db.requests.find((r) => r.id === id)
  if (!ar) return { error: fail("OAUTH_REQUEST_NOT_FOUND", { ref: rid() }) } as const
  if (Date.now() - ar.created_at > REQUEST_TTL)
    return { error: fail("OAUTH_REQUEST_EXPIRED", { ref: rid() }) } as const
  return { ar } as const
}

// ---------- handlers ----------

const A = "*/v1/account"
const O = "*/v1/oauth"

export const handlers = [
  http.all("*/v1/*", async () => {
    if (LATENCY) await delay(LATENCY)
  }),

  http.get(`${A}/csrf`, () => ok({ token: csrfToken(getDb()) })),

  http.get(`${A}/session`, () => {
    const db = getDb()
    const cu = currentUser(db)
    if (!cu) return fail("AUTH_SESSION_REQUIRED")
    return ok({
      account: summary(cu.u, true),
      session: {
        id: cu.s.id,
        auth_time: new Date(cu.s.auth_time).toISOString(),
        amr: cu.s.amr,
        expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
      },
    })
  }),

  http.get(`${A}/device-accounts`, () => {
    const db = getDb()
    const accounts = db.sessions
      .filter((s) => s.on_this_device)
      .map((s) => ({
        session_id: s.id,
        account: summary(
          db.users.find((u) => u.id === s.user_id)!,
          s.id === db.active_session,
        ),
        active: s.id === db.active_session && !s.signed_out,
        signed_out: s.signed_out,
      }))
      .slice(0, 5)
    return ok({ accounts })
  }),

  http.delete(`${A}/device-accounts/:sessionId`, ({ request, params }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    db.sessions = db.sessions.filter((s) => !(s.id === params.sessionId && s.on_this_device && s.signed_out))
    saveDb()
    return ok({})
  }),

  http.post(`${A}/session/switch`, async ({ request }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    const { session_id } = await body<{ session_id: string }>(request)
    const s = db.sessions.find((x) => x.id === session_id && x.on_this_device && !x.signed_out)
    if (!s) return fail("AUTH_SESSION_REQUIRED")
    db.active_session = s.id
    db.csrf_seq++
    saveDb()
    return ok({
      account: summary(
        db.users.find((u) => u.id === s.user_id)!,
        true,
      ),
    })
  }),

  http.post(`${A}/email/start`, async ({ request }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    const b = await body<{ email?: string; intent: string; request_id?: string }>(request)
    let email = (b.email ?? "").trim().toLowerCase()
    if (b.intent === "reauth") {
      const cu = currentUser(db)
      if (!cu) return fail("AUTH_SESSION_REQUIRED")
      email = cu.u.email
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return fail("VALIDATION_FAILED", { fields: { email: "invalid" } })
    if (email === "turnstile@example.com") return fail("AUTH_TURNSTILE_FAILED")
    if (email === "ratelimit@example.com") return fail("RATE_LIMITED", { retry_after: 75 })
    const wait = emailRateLimited(db, email)
    if (wait) return fail("RATE_LIMITED", { retry_after: wait })
    const now = Date.now()
    const flow = {
      id: mockId("fl"),
      email,
      intent: b.intent as MockDb["flows"][number]["intent"],
      attempts: 0,
      expires_at: now + CODE_TTL,
      resend_at: now + RESEND_AFTER,
      request_id: b.request_id,
    }
    db.flows.push(flow)
    saveDb()
    return ok(
      {
        flow_id: flow.id,
        expires_at: new Date(flow.expires_at).toISOString(),
        resend_available_at: new Date(flow.resend_at).toISOString(),
        code_length: 6 as const,
      },
      202,
    )
  }),

  http.post(`${A}/email/resend`, async ({ request }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    const { flow_id } = await body<{ flow_id: string }>(request)
    const flow = db.flows.find((f) => f.id === flow_id)
    if (!flow) return fail("AUTH_CODE_EXPIRED")
    const now = Date.now()
    if (now < flow.resend_at)
      return fail("RATE_LIMITED", { retry_after: Math.ceil((flow.resend_at - now) / 1000) })
    flow.attempts = 0
    flow.expires_at = now + CODE_TTL
    flow.resend_at = now + RESEND_AFTER
    saveDb()
    return ok({
      resend_available_at: new Date(flow.resend_at).toISOString(),
      expires_at: new Date(flow.expires_at).toISOString(),
    })
  }),

  http.post(`${A}/email/verify`, async ({ request }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    const { flow_id, code } = await body<{ flow_id: string; code: string }>(request)
    const flow = db.flows.find((f) => f.id === flow_id && f.intent !== "email_change")
    if (!flow || Date.now() > flow.expires_at || code === CODE_EXPIRED) return fail("AUTH_CODE_EXPIRED")
    if (code === CODE_ATTEMPTS || flow.attempts >= 5) return fail("AUTH_CODE_ATTEMPTS")
    if (code !== CODE_OK) {
      flow.attempts++
      saveDb()
      if (flow.attempts >= 5) return fail("AUTH_CODE_ATTEMPTS")
      return fail("AUTH_CODE_INVALID", { attempts_left: 5 - flow.attempts })
    }
    db.flows = db.flows.filter((f) => f.id !== flow.id)
    const u = db.users.find((x) => x.email === flow.email)
    if (flow.intent === "reset") {
      if (!u) return fail("AUTH_CODE_INVALID", { attempts_left: 0 })
      const reset_token = mockId("rt")
      db.reset_tokens[reset_token] = { user_id: u.id, expires_at: Date.now() + 10 * 60_000 }
      saveDb()
      return ok({ status: "reset_ready" as const, reset_token })
    }
    if (flow.intent === "reauth") {
      const cu = currentUser(db)
      if (!cu) return fail("AUTH_SESSION_REQUIRED")
      cu.s.auth_time = Date.now()
      cu.s.amr = Array.from(new Set([...cu.s.amr, "otp" as const]))
      db.csrf_seq++
      event(cu.u, "auth.reauth")
      saveDb()
      return ok({
        status: "signed_in" as const,
        account: summary(cu.u, true),
        auth_time: new Date(cu.s.auth_time).toISOString(),
      })
    }
    if (!u) {
      const profile_token = mockId("pt")
      db.profile_tokens[profile_token] = { email: flow.email, expires_at: Date.now() + 30 * 60_000 }
      saveDb()
      return ok({ status: "needs_profile" as const, profile_token, email: flow.email })
    }
    const r = signIn(db, u, "otp")
    saveDb()
    if ("error" in r) return r.error
    return ok({
      status: "signed_in" as const,
      account: summary(u, true),
      auth_time: new Date(r.s.auth_time).toISOString(),
    })
  }),

  http.post(`${A}/signup/complete`, async ({ request }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    const b = await body<{ profile_token: string; display_name: string; locale: "tr" | "en" }>(request)
    const pt = db.profile_tokens[b.profile_token]
    if (!pt || Date.now() > pt.expires_at) return fail("AUTH_CODE_EXPIRED")
    const name = (b.display_name ?? "").trim()
    if (!name || name.length > 40) return fail("VALIDATION_FAILED", { fields: { display_name: "length" } })
    if (db.users.some((u) => u.email === pt.email)) return fail("EMAIL_TAKEN")
    const u: MockUser = {
      id: mockId(),
      email: pt.email,
      display_name: name,
      locale: b.locale,
      created_at: new Date().toISOString(),
      status: "active",
      privacy: { location_history_opt_in: false, product_emails: false },
      events: [],
      exports: [],
    }
    db.users.push(u)
    delete db.profile_tokens[b.profile_token]
    signIn(db, u, "otp")
    saveDb()
    return ok({ account: summary(u, true) })
  }),

  http.post(`${A}/password/login`, async ({ request }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    const b = await body<{ email: string; password: string }>(request)
    const email = (b.email ?? "").trim().toLowerCase()
    if (email === "ratelimit@example.com") return fail("RATE_LIMITED", { retry_after: 600 })
    const u = db.users.find((x) => x.email === email)
    if (!u || !u.password || u.password !== b.password) return fail("AUTH_PASSWORD_INVALID")
    const r = signIn(db, u, "pwd")
    saveDb()
    if ("error" in r) return r.error
    return ok({ account: summary(u, true) })
  }),

  http.post(`${A}/password/reset`, async ({ request }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    const b = await body<{ reset_token: string; new_password: string }>(request)
    const rt = db.reset_tokens[b.reset_token]
    if (!rt || Date.now() > rt.expires_at) return fail("AUTH_CODE_EXPIRED")
    const pwErr = passwordProblem(b.new_password)
    if (pwErr) return pwErr
    const u = db.users.find((x) => x.id === rt.user_id)!
    u.password = b.new_password
    u.password_updated_at = new Date().toISOString()
    delete db.reset_tokens[b.reset_token]
    for (const s of db.sessions) if (s.user_id === u.id) s.signed_out = true
    db.sessions = db.sessions.filter((s) => s.user_id !== u.id || s.on_this_device)
    event(u, "password.reset")
    const r = signIn(db, u, "pwd")
    saveDb()
    if ("error" in r) return r.error
    return ok({ account: summary(u, true) })
  }),

  http.post(`${A}/reauth`, async ({ request }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    const r = requireSession(db)
    if ("error" in r) return r.error
    const { password } = await body<{ password: string }>(request)
    if (!r.cu.u.password || r.cu.u.password !== password) return fail("AUTH_PASSWORD_INVALID")
    r.cu.s.auth_time = Date.now()
    r.cu.s.amr = Array.from(new Set([...r.cu.s.amr, "pwd" as const]))
    db.csrf_seq++
    event(r.cu.u, "auth.reauth")
    saveDb()
    return ok({ auth_time: new Date(r.cu.s.auth_time).toISOString() })
  }),

  http.get(`${A}/profile`, () => {
    const db = getDb()
    const r = requireSession(db)
    if ("error" in r) return r.error
    return ok(profileOf(r.cu.u))
  }),

  http.patch(`${A}/profile`, async ({ request }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    const r = requireSession(db)
    if ("error" in r) return r.error
    const b = await body<{ display_name?: string; locale?: "tr" | "en" }>(request)
    if (b.display_name !== undefined) {
      const name = b.display_name.trim()
      if (!name || name.length > 40) return fail("VALIDATION_FAILED", { fields: { display_name: "length" } })
      r.cu.u.display_name = name
    }
    if (b.locale) r.cu.u.locale = b.locale
    saveDb()
    return ok(profileOf(r.cu.u))
  }),

  http.post(`${A}/email/change`, async ({ request }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    const r = requireSession(db)
    if ("error" in r) return r.error
    const sudo = requireSudo(r.cu.s)
    if (sudo) return sudo
    const { new_email } = await body<{ new_email: string }>(request)
    const email = (new_email ?? "").trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return fail("VALIDATION_FAILED", { fields: { new_email: "invalid" } })
    const now = Date.now()
    const flow = {
      id: mockId("fl"),
      email,
      intent: "email_change" as const,
      user_id: r.cu.u.id,
      attempts: 0,
      expires_at: now + CODE_TTL,
      resend_at: now + RESEND_AFTER,
    }
    db.flows.push(flow)
    saveDb()
    return ok(
      {
        flow_id: flow.id,
        expires_at: new Date(flow.expires_at).toISOString(),
        resend_available_at: new Date(flow.resend_at).toISOString(),
      },
      202,
    )
  }),

  http.post(`${A}/email/change/verify`, async ({ request }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    const r = requireSession(db)
    if ("error" in r) return r.error
    const sudo = requireSudo(r.cu.s)
    if (sudo) return sudo
    const { flow_id, code } = await body<{ flow_id: string; code: string }>(request)
    const flow = db.flows.find((f) => f.id === flow_id && f.intent === "email_change")
    if (!flow || code === CODE_EXPIRED) return fail("AUTH_CODE_EXPIRED")
    if (code === CODE_ATTEMPTS) return fail("AUTH_CODE_ATTEMPTS")
    if (code !== CODE_OK) {
      flow.attempts++
      saveDb()
      return fail("AUTH_CODE_INVALID", { attempts_left: Math.max(0, 5 - flow.attempts) })
    }
    if (db.users.some((u) => u.email === flow.email)) return fail("EMAIL_TAKEN")
    r.cu.u.email = flow.email
    db.flows = db.flows.filter((f) => f.id !== flow.id)
    event(r.cu.u, "email.changed")
    saveDb()
    return ok({ email: flow.email })
  }),

  http.get(`${A}/sessions`, () => {
    const db = getDb()
    const r = requireSession(db)
    if ("error" in r) return r.error
    const sessions = db.sessions
      .filter((s) => s.user_id === r.cu.u.id && !s.signed_out)
      .map((s) => ({
        id: s.id,
        current: s.id === r.cu.s.id,
        device: s.device,
        approx_location: s.approx_location,
        created_at: s.created_at,
        last_seen_at: s.last_seen_at,
        amr: s.amr,
        apps: s.apps,
      }))
    return ok({ sessions })
  }),

  http.delete(`${A}/sessions/:sessionId`, ({ request, params }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    const r = requireSession(db)
    if ("error" in r) return r.error
    const s = db.sessions.find((x) => x.id === params.sessionId && x.user_id === r.cu.u.id)
    if (!s) return fail("NOT_FOUND")
    s.signed_out = true
    if (!s.on_this_device) db.sessions = db.sessions.filter((x) => x.id !== s.id)
    event(r.cu.u, "session.revoked")
    saveDb()
    return ok({})
  }),

  http.post(`${A}/sessions/revoke-others`, ({ request }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    const r = requireSession(db)
    if ("error" in r) return r.error
    const sudo = requireSudo(r.cu.s)
    if (sudo) return sudo
    const others = db.sessions.filter((s) => s.user_id === r.cu.u.id && s.id !== r.cu.s.id && !s.signed_out)
    db.sessions = db.sessions.filter((s) => !others.includes(s) || s.on_this_device)
    for (const s of others) s.signed_out = true
    event(r.cu.u, "session.revoked")
    saveDb()
    return ok({ revoked: others.length })
  }),

  http.get(`${A}/apps`, () => {
    const db = getDb()
    const r = requireSession(db)
    if ("error" in r) return r.error
    return ok({ apps: connectedApps(db, r.cu.u.id) })
  }),

  http.delete(`${A}/apps/:clientId`, ({ request, params }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    const r = requireSession(db)
    if ("error" in r) return r.error
    db.grants = db.grants.filter((g) => !(g.user_id === r.cu.u.id && g.client_id === params.clientId))
    event(r.cu.u, "app.revoked")
    saveDb()
    return ok({})
  }),

  http.get(`${A}/security`, () => {
    const db = getDb()
    const r = requireSession(db)
    if ("error" in r) return r.error
    return ok({
      has_password: Boolean(r.cu.u.password),
      password_updated_at: r.cu.u.password_updated_at ?? null,
      passkeys: [],
      recent_events: r.cu.u.events,
    })
  }),

  http.put(`${A}/password`, async ({ request }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    const r = requireSession(db)
    if ("error" in r) return r.error
    const sudo = requireSudo(r.cu.s)
    if (sudo) return sudo
    const b = await body<{ new_password: string; keep_sessions?: boolean }>(request)
    const pwErr = passwordProblem(b.new_password)
    if (pwErr) return pwErr
    const had = Boolean(r.cu.u.password)
    r.cu.u.password = b.new_password
    r.cu.u.password_updated_at = new Date().toISOString()
    if (!b.keep_sessions)
      db.sessions = db.sessions.filter(
        (s) => s.user_id !== r.cu.u.id || s.id === r.cu.s.id || s.on_this_device,
      )
    event(r.cu.u, had ? "password.changed" : "password.set")
    saveDb()
    return ok({})
  }),

  http.delete(`${A}/password`, ({ request }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    const r = requireSession(db)
    if ("error" in r) return r.error
    const sudo = requireSudo(r.cu.s)
    if (sudo) return sudo
    delete r.cu.u.password
    delete r.cu.u.password_updated_at
    event(r.cu.u, "password.removed")
    saveDb()
    return ok({})
  }),

  http.get(`${A}/privacy`, () => {
    const db = getDb()
    const r = requireSession(db)
    if ("error" in r) return r.error
    return ok(r.cu.u.privacy)
  }),

  http.patch(`${A}/privacy`, async ({ request }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    const r = requireSession(db)
    if ("error" in r) return r.error
    const b = await body<Partial<MockUser["privacy"]>>(request)
    r.cu.u.privacy = { ...r.cu.u.privacy, ...b }
    saveDb()
    return ok(r.cu.u.privacy)
  }),

  http.get(`${A}/export`, () => {
    const db = getDb()
    const r = requireSession(db)
    if ("error" in r) return r.error
    // Queued exports become ready after a few seconds.
    for (const e of r.cu.u.exports) {
      if (e.status === "queued" && Date.now() - new Date(e.created_at).getTime() > 4000) {
        e.status = "ready"
        e.expires_at = new Date(Date.now() + 7 * 86400_000).toISOString()
        e.size_bytes = 51234
      }
    }
    saveDb()
    return ok({ exports: r.cu.u.exports })
  }),

  http.post(`${A}/export`, ({ request }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    const r = requireSession(db)
    if ("error" in r) return r.error
    const sudo = requireSudo(r.cu.s)
    if (sudo) return sudo
    const id = mockId("ex")
    r.cu.u.exports.unshift({ id, status: "queued", created_at: new Date().toISOString() })
    saveDb()
    return ok({ export_id: id, status: "queued" as const }, 202)
  }),

  http.get(`${A}/export/:exportId/download`, ({ params }) => {
    const db = getDb()
    const r = requireSession(db)
    if ("error" in r) return r.error
    const sudo = requireSudo(r.cu.s)
    if (sudo) return sudo
    const e = r.cu.u.exports.find((x) => x.id === params.exportId && x.status === "ready")
    if (!e) return fail("NOT_FOUND")
    return new HttpResponse(new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...new Array(18).fill(0)]), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="gezcez-export-${e.id}.zip"`,
      },
    })
  }),

  http.get(`${A}/export/:exportId`, ({ params }) => {
    const db = getDb()
    const r = requireSession(db)
    if ("error" in r) return r.error
    const e = r.cu.u.exports.find((x) => x.id === params.exportId)
    return e ? ok(e) : fail("NOT_FOUND")
  }),

  http.post(`${A}/delete`, async ({ request }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    const r = requireSession(db)
    if ("error" in r) return r.error
    const sudo = requireSudo(r.cu.s)
    if (sudo) return sudo
    const { confirm } = await body<{ confirm: string }>(request)
    if ((confirm ?? "").trim().toLowerCase() !== r.cu.u.email)
      return fail("VALIDATION_FAILED", { fields: { confirm: "mismatch" } })
    r.cu.u.status = "pending_deletion"
    r.cu.u.delete_at = new Date(Date.now() + 14 * 86400_000).toISOString()
    for (const s of db.sessions) if (s.user_id === r.cu.u.id) s.signed_out = true
    db.active_session = null
    db.csrf_seq++
    saveDb()
    return ok({ delete_at: r.cu.u.delete_at })
  }),

  http.post(`${A}/delete/cancel`, ({ request }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    const r = requireSession(db)
    if ("error" in r) return r.error
    r.cu.u.status = "active"
    delete r.cu.u.delete_at
    saveDb()
    return ok({})
  }),

  // ---------- /v1/oauth ----------

  http.post(`${O}/authorize`, async ({ request }) => {
    const db = getDb()
    const { params = {} } = await body<{ params: Record<string, string> }>(request)
    const client = CLIENTS.find((c) => c.client_id === params.client_id)
    if (!client) return fail("OAUTH_INVALID_CLIENT", { ref: rid() })
    if (!params.redirect_uri || !client.redirect_uris.includes(params.redirect_uri))
      return fail("OAUTH_INVALID_REDIRECT_URI", { ref: rid() })
    const ar: MockAuthRequest = {
      id: mockId("ar"),
      params,
      client_id: client.client_id,
      created_at: Date.now(),
    }
    const invalid =
      params.response_type !== "code" ||
      params.code_challenge_method !== "S256" ||
      !/^[A-Za-z0-9._~-]{43,128}$/.test(params.code_challenge ?? "") ||
      !params.state
    db.requests.push(ar)
    saveDb()
    const snap = snapshot(db, ar)
    if (invalid) {
      return ok({
        ...snap,
        next: "redirect" as const,
        redirect_to: `${params.redirect_uri}?error=invalid_request&state=${encodeURIComponent(params.state ?? "")}`,
      })
    }
    const scopes = (params.scope ?? "").split(/\s+/).filter(Boolean)
    if (scopes.some((s) => !client.allowed_scopes.includes(s))) {
      return ok({
        ...snap,
        next: "redirect" as const,
        redirect_to: `${params.redirect_uri}?error=invalid_scope&state=${encodeURIComponent(params.state ?? "")}`,
      })
    }
    return ok(snap)
  }),

  http.get(`${O}/authorize/:requestId`, ({ params }) => {
    const db = getDb()
    const r = findRequest(db, String(params.requestId))
    if ("error" in r) return r.error
    saveDb()
    return ok(snapshot(db, r.ar))
  }),

  http.post(`${O}/authorize/:requestId/continue`, async ({ request, params }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    const r = findRequest(db, String(params.requestId))
    if ("error" in r) return r.error
    const { session_id } = await body<{ session_id?: string }>(request)
    if (session_id) {
      const s = db.sessions.find((x) => x.id === session_id && x.on_this_device && !x.signed_out)
      if (!s) return fail("AUTH_SESSION_REQUIRED")
      db.active_session = s.id
      db.csrf_seq++
    }
    if (!currentUser(db)) return fail("AUTH_SESSION_REQUIRED")
    r.ar.chosen_session = db.active_session ?? undefined
    const n = requestNext(db, r.ar)
    saveDb()
    return ok({ next: n.next, redirect_to: n.redirect_to ?? null })
  }),

  http.post(`${O}/authorize/:requestId/decision`, async ({ request, params }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    const r = findRequest(db, String(params.requestId))
    if ("error" in r) return r.error
    const { decision } = await body<{ decision: "approve" | "deny" }>(request)
    const p = r.ar.params
    if (decision === "deny") {
      return ok({
        redirect_to: `${p.redirect_uri}?error=access_denied&state=${encodeURIComponent(p.state ?? "")}`,
      })
    }
    const cu = currentUser(db)
    if (!cu) return fail("AUTH_SESSION_REQUIRED")
    const scopes = (p.scope ?? "").split(/\s+/).filter(Boolean)
    const g = db.grants.find((x) => x.user_id === cu.u.id && x.client_id === r.ar.client_id)
    if (g) g.scopes = Array.from(new Set([...g.scopes, ...scopes]))
    else
      db.grants.push({
        user_id: cu.u.id,
        client_id: r.ar.client_id,
        scopes,
        granted_at: new Date().toISOString(),
      })
    r.ar.params = { ...p, prompt: (p.prompt ?? "").replace("consent", "") }
    const n = requestNext(db, r.ar)
    saveDb()
    return ok({
      redirect_to:
        n.redirect_to ?? `${p.redirect_uri}?error=server_error&state=${encodeURIComponent(p.state ?? "")}`,
    })
  }),

  http.post(`${O}/logout`, async ({ request }) => {
    const db = getDb()
    const bad = checkCsrf(request, db)
    if (bad) return bad
    const b = await body<{
      scope: "session" | "device"
      client_id?: string
      post_logout_redirect_uri?: string
      state?: string
    }>(request)
    if (b.client_id || b.post_logout_redirect_uri) {
      const client = CLIENTS.find((c) => c.client_id === b.client_id)
      const registered =
        client &&
        b.post_logout_redirect_uri &&
        client.post_logout_redirect_uris.includes(b.post_logout_redirect_uri)
      if (!registered) return ok({ redirect_to: null })
      endSessions(db, "session")
      const state = b.state ? `?state=${encodeURIComponent(b.state)}` : ""
      saveDb()
      return ok({ redirect_to: `${b.post_logout_redirect_uri}${state}` })
    }
    endSessions(db, b.scope)
    saveDb()
    return ok({ redirect_to: null })
  }),
]

function endSessions(db: MockDb, scope: "session" | "device") {
  for (const s of db.sessions) {
    if (scope === "device" ? s.on_this_device : s.id === db.active_session) s.signed_out = true
  }
  db.active_session = null
  db.csrf_seq++
}

function profileOf(u: MockUser) {
  return {
    id: u.id,
    display_name: u.display_name,
    email: u.email,
    email_verified_at: u.created_at,
    locale: u.locale,
    created_at: u.created_at,
    has_password: Boolean(u.password),
    passkey_count: 0,
    deletion: u.delete_at ? { delete_at: u.delete_at } : null,
  }
}

function passwordProblem(pw: string | undefined) {
  if (!pw || pw.length < 10) return fail("AUTH_PASSWORD_WEAK", { reasons: ["too_short"] })
  if (pw.length > 128) return fail("VALIDATION_FAILED", { fields: { new_password: "too_long" } })
  if (pw === "breached-password-123" || pw === ADA_PASSWORD.toUpperCase())
    return fail("AUTH_PASSWORD_BREACHED")
  return null
}
