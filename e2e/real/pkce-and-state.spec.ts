import type { Page } from "@playwright/test"
import { createVerifier } from "../fixtures/test-client/pkce"
import {
  API,
  CLIENT,
  OAUTH,
  clientResult,
  expect,
  signInWithCode,
  startLogin,
  test,
  tokenRequest,
  uniqueEmail,
  type ClientResult,
} from "./fixtures"

/**
 * Runs a login but stops the browser at the client's callback, so the test holds the real code
 * and state and decides what to do with them.
 */
async function captureCallback(page: Page, signIn: () => Promise<void>) {
  let callback: URL | null = null
  await page.route(`${CLIENT}/callback**`, async (route) => {
    callback = new URL(route.request().url())
    await route.fulfill({ status: 200, contentType: "text/html", body: "<h1>held</h1>" })
  })
  await startLogin(page)
  await signIn()
  await expect.poll(() => callback !== null).toBe(true)
  await page.unroute(`${CLIENT}/callback**`)
  const url = callback as unknown as URL
  const res = await page.request.get(`${CLIENT}/api/txn`, {
    params: { state: url.searchParams.get("state")! },
  })
  const txn = (await res.json()) as ClientResult
  return { code: url.searchParams.get("code")!, state: url.searchParams.get("state")!, txn }
}

test.describe("PKCE and state", () => {
  test("the test client rejects a tampered state and never spends the code", async ({ page }) => {
    const held = await captureCallback(page, () =>
      signInWithCode(page, uniqueEmail("pkce"), { newAccount: true }),
    )
    await page.goto(`${CLIENT}/callback?code=${encodeURIComponent(held.code)}&state=tampered`)
    await expect(page.getByRole("heading", { name: "state_mismatch" })).toBeVisible()
    // The code is still unused: the proper exchange works.
    const ok = await tokenRequest(page.request, {
      grant_type: "authorization_code",
      code: held.code,
      redirect_uri: held.txn.redirect_uri,
      client_id: "e2e_client",
      code_verifier: held.txn.verifier,
    })
    expect(ok.status, JSON.stringify(ok.body)).toBe(200)
  })

  test("a replayed code is rejected by the token endpoint", async ({ page }) => {
    await startLogin(page)
    await signInWithCode(page, uniqueEmail("pkce"), { newAccount: true })
    const result = await clientResult(page)
    expect(result.status).toBe("signed_in")
    const replay = await tokenRequest(page.request, {
      grant_type: "authorization_code",
      code: result.code!,
      redirect_uri: result.redirect_uri,
      client_id: "e2e_client",
      code_verifier: result.verifier,
    })
    expect(replay.status).toBe(400)
    expect(replay.body?.error).toBe("invalid_grant")
  })

  test("a wrong code_verifier is rejected", async ({ page }) => {
    const held = await captureCallback(page, () =>
      signInWithCode(page, uniqueEmail("pkce"), { newAccount: true }),
    )
    const wrong = await tokenRequest(page.request, {
      grant_type: "authorization_code",
      code: held.code,
      redirect_uri: held.txn.redirect_uri,
      client_id: "e2e_client",
      code_verifier: createVerifier(),
    })
    expect(wrong.status).toBe(400)
    expect(wrong.body?.error).toBe("invalid_grant")
  })

  test("an unregistered redirect_uri shows /error and never leaves the oauth app", async ({ page }) => {
    const left: string[] = []
    page.on("framenavigated", (f) => {
      if (f === page.mainFrame() && !f.url().startsWith(OAUTH) && !f.url().startsWith(CLIENT))
        left.push(f.url())
    })
    await startLogin(page, { redirect_uri: "https://evil.example/callback" })
    await expect(page).toHaveURL(new RegExp(`^${OAUTH}/error\\?code=OAUTH_INVALID_REDIRECT_URI`))
    await expect(page.getByRole("heading", { name: "This sign-in link is broken" })).toBeVisible()
    await expect(page.getByText("evil.example")).toHaveCount(0)
    expect(left).toEqual([])
  })

  test("an unknown client shows /error", async ({ page }) => {
    await startLogin(page, { client: "no_such_client" })
    await expect(page.getByRole("heading", { name: "We don't know this app" })).toBeVisible()
  })

  test("a bad scope goes back to the client as invalid_scope", async ({ page }) => {
    await startLogin(page, { scope: "openid not_a_scope" })
    const result = await clientResult(page)
    expect(result.status).toBe("error")
    expect(result.error).toBe("invalid_scope")
    expect(result.iss).toBe(API)
  })
})
