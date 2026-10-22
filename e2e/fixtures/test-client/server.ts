import { createServer, type Server } from "node:http"
import { challengeFor, createVerifier } from "./pkce"

/**
 * Minimal public OAuth client for the real-backend e2e (client e2e_client / e2e_third_party,
 * redirect http://localhost:4710/callback, seeded by the backend in NODE_ENV=test).
 *   GET /start?client_id=&scope=&prompt=&max_age=  -> 302 to {OAUTH}/authorize with PKCE + state
 *   GET /callback?code=&state=                     -> exchanges the code, shows the token response
 */
export type TestClientOptions = { port?: number; oauthUrl: string; apiUrl: string }

export function startTestClient({ port = 4710, oauthUrl, apiUrl }: TestClientOptions): Promise<Server> {
  const pending = new Map<string, { verifier: string; clientId: string }>()
  const redirectUri = `http://localhost:${port}/callback`
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`)
    if (url.pathname === "/start") {
      const clientId = url.searchParams.get("client_id") ?? "e2e_client"
      const verifier = createVerifier()
      const state = createVerifier(12)
      pending.set(state, { verifier, clientId })
      const auth = new URL("/authorize", oauthUrl)
      auth.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: url.searchParams.get("scope") ?? "openid profile email",
        state,
        code_challenge: challengeFor(verifier),
        code_challenge_method: "S256",
        ...Object.fromEntries(
          ["prompt", "max_age", "login_hint", "ui_locales"].flatMap((k) => {
            const v = url.searchParams.get(k)
            return v ? [[k, v]] : []
          }),
        ),
      }).toString()
      res.writeHead(302, { location: auth.toString() }).end()
      return
    }
    if (url.pathname === "/callback") {
      const error = url.searchParams.get("error")
      const state = url.searchParams.get("state") ?? ""
      const entry = pending.get(state)
      if (error || !entry) {
        res.writeHead(400, { "content-type": "text/html" }).end(`<h1>error: ${error ?? "unknown state"}</h1>`)
        return
      }
      pending.delete(state)
      const tokenRes = await fetch(`${apiUrl}/v1/oauth/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: url.searchParams.get("code") ?? "",
          redirect_uri: redirectUri,
          client_id: entry.clientId,
          code_verifier: entry.verifier,
        }),
      })
      const body = (await tokenRes.json()) as Record<string, unknown>
      const ok = tokenRes.ok && typeof body.access_token === "string"
      res
        .writeHead(ok ? 200 : 502, { "content-type": "text/html" })
        .end(
          `<h1>${ok ? "signed in" : "token exchange failed"}</h1><pre id="token">${ok ? "ok" : JSON.stringify(body)}</pre>`,
        )
      return
    }
    res.writeHead(200, { "content-type": "text/html" }).end("<h1>e2e client</h1>")
  })
  return new Promise((resolve) => server.listen(port, () => resolve(server)))
}
