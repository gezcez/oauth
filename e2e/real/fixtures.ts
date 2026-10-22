import {
  test as base,
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test"

/** Set by playwright.real.config.ts before the workers start. */
export const API = process.env.E2E_API_URL ?? "http://localhost:8080"
export const OAUTH = process.env.E2E_OAUTH_URL ?? "http://localhost:5174"
export const CLIENT = `http://localhost:${process.env.TEST_CLIENT_PORT ?? "4710"}`

/**
 * Turnstile is replaced by a stub that hands out the official always-pass dummy token: the
 * backend runs without TURNSTILE_SECRET in test mode, and the suite must not depend on
 * challenges.cloudflare.com being reachable.
 */
const TURNSTILE_STUB = `
(() => {
  const widgets = new Map()
  let n = 0
  window.turnstile = {
    render(el, opts) { const id = "w" + ++n; widgets.set(id, opts); return id },
    execute(id) { const o = widgets.get(id); setTimeout(() => o && o.callback && o.callback("XXXX.DUMMY.TOKEN.XXXX"), 0) },
    reset() {},
    remove(id) { widgets.delete(id) },
  }
})()`

/** Installs the Turnstile stub for every page of a context (popups and extra contexts too). */
export async function stubTurnstile(context: BrowserContext) {
  await context.route("https://challenges.cloudflare.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: TURNSTILE_STUB }),
  )
}

let counter = 0
/** A fresh address per call, so per-email rate limits and accounts never collide. */
export function uniqueEmail(tag = "user"): string {
  counter += 1
  return `e2e-${tag}-${Date.now().toString(36)}-${process.pid}-${counter}@example.com`
}

interface MailboxEntry {
  to: string
  template: string
  subject: string
  code?: string
  sent_at: string
}

/** Waits for a new mail (more than `after` messages) to `to` and returns it. */
export async function waitForMail(request: APIRequestContext, to: string, after = 0): Promise<MailboxEntry> {
  let messages: MailboxEntry[] = []
  await expect
    .poll(
      async () => {
        const res = await request.get(`${API}/v1/__test/mailbox`, { params: { to } })
        const body = (await res.json()) as { data?: { messages: MailboxEntry[] }; messages?: MailboxEntry[] }
        messages = body.data?.messages ?? body.messages ?? []
        return messages.length
      },
      { message: `mail to ${to}`, timeout: 10_000 },
    )
    .toBeGreaterThan(after)
  return messages[messages.length - 1]!
}

export async function mailCount(request: APIRequestContext, to: string): Promise<number> {
  const res = await request.get(`${API}/v1/__test/mailbox`, { params: { to } })
  const body = (await res.json()) as { data?: { messages: unknown[] }; messages?: unknown[] }
  return (body.data?.messages ?? body.messages ?? []).length
}

export interface ClientResult {
  id: string
  status: "pending" | "signed_in" | "error"
  client_id: string
  redirect_uri: string
  state: string
  verifier: string
  code?: string
  error?: string
  error_description?: string
  iss?: string
  tokens?: { access_token: string; refresh_token?: string; expires_in: number; scope: string }
  claims?: { sub: string; sid: string; auth_time: number; amr: string[]; aud: string; scope: string }
  me?: { status: number; body: { ok: boolean; data?: Record<string, unknown> } }
  token_error?: unknown
}

/** Starts a login at the test client; the browser lands on the oauth app's /authorize. */
export async function startLogin(page: Page, params: Record<string, string> = {}) {
  await page.goto(`${CLIENT}/login?${new URLSearchParams(params)}`)
}

/** Waits for the test client's result page and returns its JSON. */
export async function clientResult(page: Page): Promise<ClientResult> {
  await page.waitForURL(`${CLIENT}/done?**`)
  return JSON.parse((await page.locator("#result").textContent()) ?? "{}") as ClientResult
}

export async function enterEmail(page: Page, email: string) {
  await page.getByLabel("Email").fill(email)
  await page.getByRole("button", { name: "Continue" }).click()
}

/** On the code screen: reads the newest code for `email` from the test mailbox and enters it. */
export async function enterMailedCode(page: Page, email: string, after = 0) {
  const mail = await waitForMail(page.request, email, after)
  expect(mail.code, `code in ${mail.template}`).toMatch(/^\d{6}$/)
  const input = page.getByLabel("Code")
  await expect(input).toBeVisible()
  await input.fill(mail.code!)
  return mail.code!
}

/** Completes /signup/profile for a new address. */
export async function completeProfile(page: Page, name = "E2E Person") {
  await expect(page).toHaveURL(/\/signup\/profile/)
  await page.getByLabel("Display name").fill(name)
  await page.getByRole("checkbox", { name: /I accept the/ }).check()
  await page.getByRole("button", { name: "Create account" }).click()
}

/**
 * Email-code sign-in (or sign-up for a new address) from the oauth app's /signin screen.
 * Returns once the code is accepted; where the browser goes next is up to the caller.
 */
export async function signInWithCode(
  page: Page,
  email: string,
  opts: { newAccount?: boolean; name?: string } = {},
) {
  const before = await mailCount(page.request, email)
  await enterEmail(page, email)
  await enterMailedCode(page, email, before)
  if (opts.newAccount) await completeProfile(page, opts.name)
}

/** A brand-new account signed in on this page's browser context, ending on /account. */
export async function newAccount(page: Page, tag = "acct"): Promise<string> {
  const email = uniqueEmail(tag)
  await page.goto("/signin")
  await signInWithCode(page, email, { newAccount: true })
  await expect(page).toHaveURL(/\/account/)
  return email
}

export const PASSWORD = "correct horse battery staple"

/** Adds a password from /account/security (a new account is inside the step-up window). */
export async function addPassword(page: Page, password = PASSWORD) {
  await page.goto("/account/security")
  await page.getByRole("button", { name: "Add a password" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("New password").fill(password)
  await dialog.getByRole("button", { name: "Save" }).click()
  await expect(page.getByText("Your password was saved.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Change password" })).toBeVisible()
}

/** The /logout confirm page (no client), ending on /signed-out. */
export async function signOut(page: Page) {
  await page.goto("/logout")
  await page.getByRole("button", { name: "Sign out", exact: true }).click()
  await expect(page).toHaveURL(/\/signed-out/)
}

/** Token endpoint call in RFC 6749 form encoding, straight from the test (no browser). */
export async function tokenRequest(request: APIRequestContext, form: Record<string, string>) {
  const res = await request.post(`${API}/v1/oauth/token`, { form })
  return {
    status: res.status(),
    body: (await res.json().catch(() => null)) as Record<string, unknown> | null,
  }
}

export async function refreshAt(page: Page, result: ClientResult) {
  const res = await page.request.post(`${CLIENT}/api/txn/${result.id}/refresh`)
  return (await res.json()) as { status: number; body: Record<string, unknown> }
}

/**
 * Every test: Turnstile stubbed, and it fails on CSP violations or uncaught page errors on the
 * oauth app's origin (the test client is plain scaffolding and is not checked).
 */
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    const problems: string[] = []
    page.on("console", (m) => {
      if (/Content Security Policy|Refused to/i.test(m.text())) problems.push(`CSP: ${m.text()}`)
    })
    page.on("pageerror", (e) => {
      if (page.url().startsWith(OAUTH)) problems.push(`pageerror: ${e.message}`)
    })
    await stubTurnstile(page.context())
    await use(page)
    expect(problems, problems.join("\n")).toEqual([])
  },
})

export { expect }
