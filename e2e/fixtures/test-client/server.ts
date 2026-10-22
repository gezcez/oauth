/**
 * The e2e test client: a tiny relying party on TEST_CLIENT_PORT (default 4710, the port the
 * backend's test seed registers for e2e_client and e2e_third_party). It follows the client
 * contract in oauth.md section 9 closely enough to exercise the real server path:
 *
 *   GET /login?client=&scope=&prompt=&max_age=&login_hint=&redirect_uri=
 *       new PKCE verifier + state, 302 to the oauth app's /authorize
 *   GET /callback?code&state | ?error&state
 *       unknown or missing state: state_mismatch, the token endpoint is never called;
 *       otherwise exchange the code, call GET /v1/me, then 303 to /done?txn= so the address bar
 *       no longer holds the code (the web contract's history.replaceState)
 *   GET /done?txn=           result page, the JSON is in <pre id="result">
 *   GET /api/txn/:id         JSON of one transaction (tokens included; test scaffolding only)
 *   GET /api/txn?state=      the same, looked up by state
 *   POST /api/txn/:id/refresh  refresh_token grant with the transaction's refresh token
 *   GET /logout?client=&post_logout_redirect_uri=&state=  302 to the oauth app's /logout
 *   GET /opener              opens /login?popup=1&max_age=1 in a popup (dashboard step-up);
 *                            the popup's /done reports { type: "gz-step-up", ok } back
 *   GET /                    post-logout landing page, echoes the query
 *
 * Server-side on purpose: no CORS or cookie set-up is needed for the client side, so the e2e
 * suite only tests the oauth app and the backend.
 */
import http from "node:http"
import { challengeS256, createState, createVerifier } from "./pkce"

const PORT = Number(process.env.TEST_CLIENT_PORT ?? 4710)
const OAUTH_URL = (process.env.E2E_OAUTH_URL ?? "http://localhost:5174").replace(/\/+$/, "")
const API_URL = (process.env.E2E_API_URL ?? "http://localhost:8080").replace(/\/+$/, "")
const ORIGIN = `http://localhost:${PORT}`
const TXN_TTL_MS = 10 * 60_000

interface Tokens {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope: string
}

interface Txn {
  id: string
  state: string
  verifier: string
  clientId: string
  redirectUri: string
  createdAt: number
  /** Opened by /opener as a step-up popup: /done posts the result to window.opener. */
  popup: boolean
  status: "pending" | "signed_in" | "error"
  code?: string
  error?: string
  errorDescription?: string
  iss?: string
  tokens?: Tokens
  claims?: Record<string, unknown>
  me?: unknown
  tokenError?: unknown
}

const byState = new Map<string, Txn>()
const byId = new Map<string, Txn>()

function send(res: http.ServerResponse, status: number, body: string, type = "text/html; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" })
  res.end(body)
}

function redirect(res: http.ServerResponse, location: string, status = 302) {
  res.writeHead(status, { Location: location, "Cache-Control": "no-store" })
  res.end()
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

function page(title: string, body: unknown): string {
  return `<!doctype html><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<h1>${escapeHtml(title)}</h1><pre id="result">${escapeHtml(JSON.stringify(body, null, 2))}</pre>`
}

/**
 * The dashboard's /auth/step-up page in miniature: report the result, then close. The oauth app
 * sends Cross-Origin-Opener-Policy: same-origin, so by the time the popup is back on the
 * client's origin `window.opener` is null; the result goes over a same-origin BroadcastChannel
 * instead (postMessage to the opener is kept for when an opener survives).
 */
function popupScript(txn: Txn): string {
  const message = JSON.stringify({
    type: "gz-step-up",
    ok: txn.status === "signed_in",
    txn: txn.id,
  })
  return `<script>
const message = ${message}
message.via = window.opener ? "opener" : "broadcast"
if (window.opener) window.opener.postMessage(message, ${JSON.stringify(ORIGIN)})
else new BroadcastChannel("gz.auth.step-up").postMessage(message)
window.close()
</script>`
}

/** A page that starts a step-up in a popup and lists the messages it gets back. */
const OPENER_PAGE = `<!doctype html><meta charset="utf-8"><title>opener</title>
<h1>opener</h1><button id="step-up">Confirm it's you</button><pre id="messages"></pre>
<script>
document.getElementById("step-up").onclick = () =>
  window.open("/login?popup=1&max_age=1", "gz-step-up", "popup,width=480,height=720")
const show = (data) => (document.getElementById("messages").textContent += JSON.stringify(data) + "\\n")
window.addEventListener("message", (e) => {
  if (e.origin === location.origin) show(e.data)
})
new BroadcastChannel("gz.auth.step-up").onmessage = (e) => show(e.data)
</script>`

function decodeJwt(token: string): Record<string, unknown> {
  const part = token.split(".")[1] ?? ""
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>
}

function publicTxn(t: Txn) {
  return {
    id: t.id,
    status: t.status,
    client_id: t.clientId,
    redirect_uri: t.redirectUri,
    state: t.state,
    verifier: t.verifier,
    code: t.code,
    error: t.error,
    error_description: t.errorDescription,
    iss: t.iss,
    tokens: t.tokens,
    claims: t.claims,
    me: t.me,
    token_error: t.tokenError,
  }
}

async function tokenRequest(form: Record<string, string>): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${API_URL}/v1/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(form),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function getMe(accessToken: string): Promise<unknown> {
  const res = await fetch(`${API_URL}/v1/me`, { headers: { Authorization: `Bearer ${accessToken}` } })
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function login(url: URL, res: http.ServerResponse) {
  const q = url.searchParams
  const clientId = q.get("client") ?? "e2e_client"
  const redirectUri = q.get("redirect_uri") ?? `${ORIGIN}/callback`
  const verifier = createVerifier()
  const state = createState()
  const txn: Txn = {
    id: createState(),
    state,
    verifier,
    clientId,
    redirectUri,
    createdAt: Date.now(),
    popup: q.get("popup") === "1",
    status: "pending",
  }
  byState.set(state, txn)
  byId.set(txn.id, txn)
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: q.get("scope") ?? "openid profile email offline_access",
    state,
    code_challenge: await challengeS256(verifier),
    code_challenge_method: "S256",
    ui_locales: q.get("ui_locales") ?? "en",
  })
  for (const key of ["prompt", "max_age", "login_hint"]) {
    const v = q.get(key)
    if (v !== null) params.set(key, v)
  }
  res.setHeader("X-Txn-Id", txn.id)
  redirect(res, `${OAUTH_URL}/authorize?${params}`)
}

async function callback(url: URL, res: http.ServerResponse) {
  const q = url.searchParams
  const state = q.get("state")
  const txn = state ? byState.get(state) : undefined
  if (!txn || Date.now() - txn.createdAt > TXN_TTL_MS) {
    send(res, 400, page("state_mismatch", { error: "state_mismatch" }))
    return
  }
  byState.delete(txn.state)
  txn.iss = q.get("iss") ?? undefined
  const error = q.get("error")
  if (error) {
    txn.status = "error"
    txn.error = error
    txn.errorDescription = q.get("error_description") ?? undefined
    redirect(res, `/done?txn=${txn.id}`, 303)
    return
  }
  txn.code = q.get("code") ?? undefined
  const exchange = await tokenRequest({
    grant_type: "authorization_code",
    code: txn.code ?? "",
    redirect_uri: txn.redirectUri,
    client_id: txn.clientId,
    code_verifier: txn.verifier,
  })
  if (exchange.status !== 200) {
    txn.status = "error"
    txn.error = "token_exchange_failed"
    txn.tokenError = exchange.body
  } else {
    txn.status = "signed_in"
    txn.tokens = exchange.body as Tokens
    txn.claims = decodeJwt(txn.tokens.access_token)
    txn.me = await getMe(txn.tokens.access_token)
  }
  redirect(res, `/done?txn=${txn.id}`, 303)
}

async function refresh(txn: Txn, res: http.ServerResponse) {
  if (!txn.tokens?.refresh_token) {
    send(res, 400, JSON.stringify({ error: "no_refresh_token" }), "application/json")
    return
  }
  const result = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: txn.tokens.refresh_token,
    client_id: txn.clientId,
  })
  if (result.status === 200) {
    txn.tokens = result.body as Tokens
    txn.claims = decodeJwt(txn.tokens.access_token)
  }
  send(res, 200, JSON.stringify(result), "application/json")
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", ORIGIN)
  const run = async () => {
    if (req.method === "GET" && url.pathname === "/health") return send(res, 200, "ok", "text/plain")
    if (req.method === "GET" && url.pathname === "/login") return login(url, res)
    if (req.method === "GET" && url.pathname === "/callback") return callback(url, res)
    if (req.method === "GET" && url.pathname === "/done") {
      const txn = byId.get(url.searchParams.get("txn") ?? "")
      if (!txn) return send(res, 404, page("not_found", {}))
      return send(res, 200, page(txn.status, publicTxn(txn)) + (txn.popup ? popupScript(txn) : ""))
    }
    if (req.method === "GET" && url.pathname === "/opener") {
      return send(res, 200, OPENER_PAGE)
    }
    if (req.method === "GET" && url.pathname === "/api/txn") {
      const state = url.searchParams.get("state") ?? ""
      const txn = [...byId.values()].find((t) => t.state === state)
      if (!txn) return send(res, 404, JSON.stringify({ error: "not_found" }), "application/json")
      return send(res, 200, JSON.stringify(publicTxn(txn)), "application/json")
    }
    const api = /^\/api\/txn\/([\w-]+)(\/refresh)?$/.exec(url.pathname)
    if (api) {
      const txn = byId.get(api[1]!)
      if (!txn) return send(res, 404, JSON.stringify({ error: "not_found" }), "application/json")
      if (api[2] && req.method === "POST") return refresh(txn, res)
      return send(res, 200, JSON.stringify(publicTxn(txn)), "application/json")
    }
    if (req.method === "GET" && url.pathname === "/logout") {
      const params = new URLSearchParams({
        client_id: url.searchParams.get("client") ?? "e2e_client",
        post_logout_redirect_uri: url.searchParams.get("post_logout_redirect_uri") ?? `${ORIGIN}/`,
      })
      const state = url.searchParams.get("state")
      if (state) params.set("state", state)
      return redirect(res, `${OAUTH_URL}/logout?${params}`)
    }
    if (req.method === "GET" && url.pathname === "/") {
      return send(res, 200, page("client home", Object.fromEntries(url.searchParams)))
    }
    send(res, 404, page("not_found", {}))
  }
  run().catch((e: unknown) => send(res, 500, page("client error", { message: String(e) })))
})

server.listen(PORT, "127.0.0.1", () => {
  console.log(`e2e test client on ${ORIGIN} (oauth ${OAUTH_URL}, api ${API_URL})`)
})
