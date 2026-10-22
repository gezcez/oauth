import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { FlaskConical, X } from "lucide-react"
import { useState } from "react"
import { invalidateCsrfToken } from "@/lib/csrf"
import { getDb, resetDb, saveDb, signInAs } from "./db"

const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
function authorizeHref(
  extra: Record<string, string> = {},
  client = "dashboard",
  redirect = "https://dash.gezcez.com/auth/callback",
) {
  const p = new URLSearchParams({
    client_id: client,
    redirect_uri: redirect,
    response_type: "code",
    scope:
      client === "e2e_third_party" ? "openid profile email transit" : "openid profile email offline_access",
    state: "mock-state-123",
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
    ...extra,
  })
  return `/authorize?${p.toString()}`
}

const LINKS: { group: string; items: { label: string; href: string }[] }[] = [
  {
    group: "OAuth",
    items: [
      { label: "Authorize (dashboard)", href: authorizeHref() },
      {
        label: "Authorize, third party (consent)",
        href: authorizeHref({}, "e2e_third_party", "https://stats.example/callback"),
      },
      { label: "Authorize, prompt=select_account", href: authorizeHref({ prompt: "select_account" }) },
      { label: "Authorize, max_age=1 (re-auth)", href: authorizeHref({ max_age: "1" }) },
      { label: "Authorize, ui_locales=tr", href: authorizeHref({ ui_locales: "tr" }) },
      { label: "Error: unknown client", href: authorizeHref({}, "nope") },
      { label: "Error: bad redirect URI", href: authorizeHref({}, "dashboard", "https://evil.example/cb") },
      { label: "Error: request expired", href: "/error?code=OAUTH_REQUEST_EXPIRED&ref=req_demo" },
      { label: "Old entry (?app=dashboard)", href: "/?app=dashboard" },
    ],
  },
  {
    group: "Sign in",
    items: [
      { label: "Sign in", href: "/signin" },
      { label: "Sign up", href: "/signup" },
      { label: "Password", href: "/signin/password" },
      { label: "Reset password", href: "/reset" },
      { label: "Re-auth (in-app)", href: "/reauth?return=/account/security" },
      { label: "Logout confirm", href: "/logout" },
      {
        label: "Logout (registered URI)",
        href: "/logout?client_id=dashboard&post_logout_redirect_uri=https%3A%2F%2Fdash.gezcez.com%2Fauth%2Flogged-out&state=s1",
      },
      { label: "Signed out", href: "/signed-out" },
      { label: "Banned (page)", href: "/banned" },
      { label: "Deletion scheduled", href: "/deletion-scheduled" },
    ],
  },
  {
    group: "Account",
    items: [
      { label: "Overview", href: "/account" },
      { label: "Profile", href: "/account/profile" },
      { label: "Email", href: "/account/email" },
      { label: "Devices", href: "/account/sessions" },
      { label: "Connected apps", href: "/account/apps" },
      { label: "Security", href: "/account/security" },
      { label: "Privacy", href: "/account/privacy" },
      { label: "Delete account", href: "/account/privacy/delete" },
      { label: "Language", href: "/account/language" },
    ],
  },
]

function freshAuth() {
  const db = getDb()
  const s = db.sessions.find((x) => x.id === db.active_session)
  if (s) s.auth_time = new Date().getTime()
}

/** Floating dev-only panel (bun run dev:mock): jump to any screen and set up mock state. */
export default function MockPanel() {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()
  const router = useRouter()
  const refresh = () => {
    invalidateCsrfToken()
    void qc.invalidateQueries()
  }
  const act = (fn: () => void) => () => {
    fn()
    saveDb()
    refresh()
  }
  return (
    <div className="fixed bottom-3 left-3 z-50 text-sm" data-mock-panel>
      {open ? (
        <div className="max-h-[80dvh] w-80 overflow-auto rounded-2xl bg-background p-4 text-foreground ring-1 ring-line-strong">
          <div className="mb-3 flex items-center justify-between">
            <strong>Mock scenarios</strong>
            <button
              type="button"
              aria-label="Close mock scenarios"
              className="inline-flex size-9 items-center justify-center rounded-full hover:bg-secondary-hover"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <p className="mb-3 text-xs text-muted">
            Code <code>123456</code> works, <code>000000</code> is expired, <code>111111</code> is too many
            tries. Password for ada@example.com: <code>correct horse battery</code>. Try banned@, deleting@,
            ratelimit@, turnstile@example.com.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full bg-primary px-3 py-1.5 font-semibold text-primary-foreground"
              onClick={act(() => signInAs("ada@example.com", { authAgoMs: 3600_000 }))}
            >
              Sign in as Ada
            </button>
            <button
              type="button"
              className="rounded-full bg-primary px-3 py-1.5 font-semibold text-primary-foreground"
              onClick={act(() => {
                signInAs("mert@example.com")
                signInAs("ada@example.com", { authAgoMs: 3600_000 })
              })}
            >
              Two accounts
            </button>
            <button
              type="button"
              className="rounded-full ring-1 ring-line-strong px-3 py-1.5 font-semibold"
              onClick={act(freshAuth)}
            >
              Fresh auth_time
            </button>
            <button
              type="button"
              className="rounded-full ring-1 ring-line-strong px-3 py-1.5 font-semibold"
              onClick={act(() => {
                const db = getDb()
                db.active_session = null
                db.csrf_seq++
              })}
            >
              Sign out
            </button>
            <button
              type="button"
              className="rounded-full ring-1 ring-line-strong px-3 py-1.5 font-semibold"
              onClick={act(() => resetDb())}
            >
              Reset
            </button>
          </div>
          {LINKS.map((g) => (
            <div key={g.group} className="mb-3">
              <p className="mb-1 text-xs font-semibold tracking-widest text-eyebrow uppercase">{g.group}</p>
              <ul className="space-y-0.5">
                {g.items.map((i) => (
                  <li key={i.href}>
                    {i.href.startsWith("/authorize") || i.href.startsWith("/?") ? (
                      <a className="text-link hover:underline" href={i.href}>
                        {i.label}
                      </a>
                    ) : (
                      <a
                        className="text-link hover:underline"
                        href={i.href}
                        onClick={(e) => {
                          e.preventDefault()
                          router.history.push(i.href)
                        }}
                      >
                        {i.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 font-semibold text-primary-foreground"
        >
          <FlaskConical className="size-4" aria-hidden /> Mock
        </button>
      )}
    </div>
  )
}
