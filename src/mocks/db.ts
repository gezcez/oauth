/**
 * In-memory stand-in for the backend used by `bun run dev:mock`, Vitest and the MSW e2e run.
 * Behaviour follows backend.md 6.1 and oauth.md 4/5 closely enough to exercise every screen.
 * Persisted to sessionStorage in the browser so reloads keep the mock "cookies".
 *
 * Magic values (also listed in README and in the mock scenarios panel):
 *   code 123456 is right, 000000 is expired, 111111 is "too many tries", anything else is wrong
 *   ada@example.com      existing account with password "correct horse battery"
 *   mert@example.com     existing account, Turkish, no password
 *   banned@example.com   suspended account (USER_BANNED after the code)
 *   deleting@example.com pending deletion (USER_PENDING_DELETION after the code)
 *   ratelimit@example.com    RATE_LIMITED on email/start
 *   turnstile@example.com    AUTH_TURNSTILE_FAILED on email/start
 *   any other address    new account (needs_profile)
 *   password "breached-password-123" -> AUTH_PASSWORD_BREACHED
 */
import type {
  Amr,
  ConnectedApp,
  DataExport,
  EmailIntent,
  Locale,
  PrivacySettings,
  SecurityEvent,
} from "@/api/schema"

export interface MockClient {
  client_id: string
  name: string
  first_party: boolean
  type: "public" | "confidential"
  redirect_uris: string[]
  post_logout_redirect_uris: string[]
  homepage_url?: string
  logo_url?: string
  allowed_scopes: string[]
}

export interface MockUser {
  id: string
  email: string
  display_name: string
  locale: Locale
  created_at: string
  password?: string
  password_updated_at?: string
  status: "active" | "banned" | "pending_deletion"
  ban?: { public_reason: string | null; since: string; until: string | null }
  delete_at?: string
  privacy: PrivacySettings
  events: SecurityEvent[]
  exports: DataExport[]
}

export interface MockSession {
  id: string
  user_id: string
  auth_time: number
  amr: Amr[]
  created_at: string
  last_seen_at: string
  device: { label: string; os: string; browser: string; kind: "desktop" | "mobile" | "app" }
  approx_location: string
  on_this_device: boolean
  signed_out: boolean
  apps: { client_id: string; name: string }[]
}

export interface MockFlow {
  id: string
  email: string
  intent: EmailIntent | "email_change"
  user_id?: string
  attempts: number
  expires_at: number
  resend_at: number
  request_id?: string
}

export interface MockAuthRequest {
  id: string
  params: Record<string, string>
  client_id: string
  created_at: number
  chosen_session?: string
}

export interface MockGrant {
  user_id: string
  client_id: string
  scopes: string[]
  granted_at: string
  last_used_at?: string
}

export interface MockDb {
  users: MockUser[]
  sessions: MockSession[]
  active_session: string | null
  flows: MockFlow[]
  requests: MockAuthRequest[]
  grants: MockGrant[]
  profile_tokens: Record<string, { email: string; expires_at: number }>
  reset_tokens: Record<string, { user_id: string; expires_at: number }>
  email_counts: Record<string, number[]>
  csrf_seq: number
  seq: number
}

export const CLIENTS: MockClient[] = [
  {
    client_id: "dashboard",
    name: "Dashboard",
    first_party: true,
    type: "public",
    redirect_uris: ["https://dash.gezcez.com/auth/callback", "https://dash.gezcez.com/auth/step-up"],
    post_logout_redirect_uris: ["https://dash.gezcez.com/auth/logged-out"],
    homepage_url: "https://dash.gezcez.com",
    allowed_scopes: ["openid", "profile", "email", "offline_access", "dash"],
  },
  {
    client_id: "mobile",
    name: "gezcez",
    first_party: true,
    type: "public",
    redirect_uris: ["gezcez://oauth/callback"],
    post_logout_redirect_uris: [],
    allowed_scopes: ["openid", "profile", "email", "offline_access", "transit"],
  },
  {
    client_id: "e2e_client",
    name: "Test Client",
    first_party: true,
    type: "public",
    redirect_uris: ["http://localhost:4710/callback", "https://client.example/callback"],
    post_logout_redirect_uris: ["https://client.example/logged-out"],
    homepage_url: "https://client.example",
    allowed_scopes: ["openid", "profile", "email", "offline_access"],
  },
  {
    client_id: "e2e_third_party",
    name: "Transit Stats",
    first_party: false,
    type: "confidential",
    redirect_uris: ["https://stats.example/callback"],
    post_logout_redirect_uris: [],
    homepage_url: "https://stats.example",
    allowed_scopes: ["openid", "profile", "email", "offline_access", "transit"],
  },
]

export const CODE_OK = "123456"
export const CODE_EXPIRED = "000000"
export const CODE_ATTEMPTS = "111111"
export const ADA_PASSWORD = "correct horse battery"

const HOUR = 3600_000
const DAY = 24 * HOUR

function iso(ms: number): string {
  return new Date(ms).toISOString()
}

const ULID_CHARS = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
export function mockId(prefix?: string): string {
  let s = ""
  for (let i = 0; i < 26; i++) s += ULID_CHARS[Math.floor(Math.random() * 32)]
  return prefix ? `${prefix}_${s}` : s
}

function user(
  partial: Partial<MockUser> & Pick<MockUser, "id" | "email" | "display_name" | "locale">,
): MockUser {
  const now = Date.now()
  return {
    created_at: iso(now - 220 * DAY),
    status: "active",
    privacy: { location_history_opt_in: false, product_emails: false },
    events: [],
    exports: [],
    ...partial,
  }
}

export function seed(): MockDb {
  const now = Date.now()
  const ada = user({
    id: "01JADA0000000000000000000A",
    email: "ada@example.com",
    display_name: "Ada Lovelace",
    locale: "en",
    password: ADA_PASSWORD,
    password_updated_at: iso(now - 40 * DAY),
    created_at: iso(now - 300 * DAY),
    privacy: { location_history_opt_in: false, product_emails: true },
    events: [
      {
        type: "auth.login",
        at: iso(now - 2 * HOUR),
        device_label: "Firefox on macOS",
        approx_location: "İstanbul, TR",
      },
      {
        type: "auth.login",
        at: iso(now - 3 * DAY),
        device_label: "gezcez app on iPhone",
        approx_location: "Ankara, TR",
      },
      {
        type: "password.changed",
        at: iso(now - 40 * DAY),
        device_label: "Firefox on macOS",
        approx_location: "İstanbul, TR",
      },
      {
        type: "auth.login",
        at: iso(now - 41 * DAY),
        device_label: "gezcez app on iPhone",
        approx_location: "Ankara, TR",
      },
    ],
    exports: [
      {
        id: "ex_01",
        status: "ready",
        created_at: iso(now - 2 * DAY),
        expires_at: iso(now + 5 * DAY),
        size_bytes: 48213,
      },
      {
        id: "ex_00",
        status: "expired",
        created_at: iso(now - 30 * DAY),
        expires_at: iso(now - 23 * DAY),
        size_bytes: 40120,
      },
    ],
  })
  const mert = user({
    id: "01JMERT000000000000000000M",
    email: "mert@example.com",
    display_name: "Mert Yılmaz",
    locale: "tr",
  })
  const banned = user({
    id: "01JBAN00000000000000000000",
    email: "banned@example.com",
    display_name: "Banned User",
    locale: "en",
    status: "banned",
    ban: {
      public_reason: "Repeated abuse of the report feature.",
      since: iso(now - 10 * DAY),
      until: iso(now + 20 * DAY),
    },
  })
  const deleting = user({
    id: "01JDEL00000000000000000000",
    email: "deleting@example.com",
    display_name: "Deniz Kaya",
    locale: "tr",
    status: "pending_deletion",
    delete_at: iso(now + 9 * DAY),
  })
  return {
    users: [ada, mert, banned, deleting],
    sessions: [
      {
        id: "ses_ada_phone",
        user_id: ada.id,
        auth_time: now - 3 * DAY,
        amr: ["otp"],
        created_at: iso(now - 3 * DAY),
        last_seen_at: iso(now - 20 * 60_000),
        device: { label: "gezcez app on iPhone", os: "iOS", browser: "gezcez", kind: "app" },
        approx_location: "Ankara, TR",
        on_this_device: false,
        signed_out: false,
        apps: [{ client_id: "mobile", name: "gezcez" }],
      },
      {
        id: "ses_ada_work",
        user_id: ada.id,
        auth_time: now - 9 * DAY,
        amr: ["pwd"],
        created_at: iso(now - 9 * DAY),
        last_seen_at: iso(now - 2 * DAY),
        device: { label: "Chrome on Windows", os: "Windows", browser: "Chrome", kind: "desktop" },
        approx_location: "İzmir, TR",
        on_this_device: false,
        signed_out: false,
        apps: [{ client_id: "dashboard", name: "Dashboard" }],
      },
    ],
    active_session: null,
    flows: [],
    requests: [],
    grants: [
      {
        user_id: ada.id,
        client_id: "dashboard",
        scopes: ["openid", "profile", "email", "offline_access", "dash"],
        granted_at: iso(now - 200 * DAY),
        last_used_at: iso(now - 2 * DAY),
      },
      {
        user_id: ada.id,
        client_id: "mobile",
        scopes: ["openid", "profile", "email", "offline_access", "transit"],
        granted_at: iso(now - 100 * DAY),
        last_used_at: iso(now - 20 * 60_000),
      },
      {
        user_id: ada.id,
        client_id: "e2e_third_party",
        scopes: ["openid", "profile"],
        granted_at: iso(now - 15 * DAY),
      },
    ],
    profile_tokens: {},
    reset_tokens: {},
    email_counts: {},
    csrf_seq: 1,
    seq: 1,
  }
}

const STORAGE_KEY = "gz.mock.db"
let memory: MockDb | null = null

function canPersist(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined" && !import.meta.env.VITEST
}

export function getDb(): MockDb {
  if (memory) return memory
  if (canPersist()) {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        memory = JSON.parse(raw) as MockDb
        return memory
      }
    } catch {
      // ignore
    }
  }
  memory = seed()
  return memory
}

export function saveDb(): void {
  if (!memory || !canPersist()) return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory))
  } catch {
    // ignore
  }
}

export function resetDb(next?: MockDb): MockDb {
  memory = next ?? seed()
  saveDb()
  return memory
}

// ---------- scenario helpers (mock panel, tests) ----------

export function newSessionFor(db: MockDb, userId: string, amr: Amr[] = ["otp"], authAgoMs = 0): MockSession {
  const now = Date.now()
  const s: MockSession = {
    id: mockId("ses"),
    user_id: userId,
    auth_time: now - authAgoMs,
    amr,
    created_at: iso(now - authAgoMs),
    last_seen_at: iso(now),
    device: { label: "Firefox on macOS", os: "macOS", browser: "Firefox", kind: "desktop" },
    approx_location: "İstanbul, TR",
    on_this_device: true,
    signed_out: false,
    apps: [],
  }
  db.sessions.push(s)
  db.active_session = s.id
  db.csrf_seq++
  return s
}

export function signInAs(email: string, opts: { authAgoMs?: number } = {}): MockDb {
  const db = getDb()
  const u = db.users.find((x) => x.email === email)
  if (!u) throw new Error(`no mock user ${email}`)
  newSessionFor(db, u.id, ["otp"], opts.authAgoMs ?? 0)
  saveDb()
  return db
}

export function connectedApps(db: MockDb, userId: string): ConnectedApp[] {
  return db.grants
    .filter((g) => g.user_id === userId)
    .map((g) => {
      const c = CLIENTS.find((x) => x.client_id === g.client_id)!
      return {
        client_id: c.client_id,
        name: c.name,
        first_party: c.first_party,
        scopes: g.scopes.map((key) => ({ key, i18n_key: `scopes.${key}` })),
        granted_at: g.granted_at,
        last_used_at: g.last_used_at ?? null,
        active_sessions: db.sessions.filter(
          (s) => s.user_id === userId && !s.signed_out && s.apps.some((a) => a.client_id === c.client_id),
        ).length,
      }
    })
}
