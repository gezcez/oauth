import { test as base, expect, type Page } from "@playwright/test"

export const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

export function authorizePath(extra: Record<string, string> = {}) {
  const p = new URLSearchParams({
    client_id: "dashboard",
    redirect_uri: "https://dash.gezcez.com/auth/callback",
    response_type: "code",
    scope: "openid profile email offline_access",
    state: "e2e-state",
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
    ...extra,
  })
  return `/authorize?${p}`
}

/**
 * Every test: fail on CSP violations and uncaught errors, stub the client apps' callback pages
 * (the SPA leaves through location.replace to them). The mock panel hides itself under webdriver.
 */
export const test = base.extend<{ app: Page }>({
  app: async ({ page }, use) => {
    const problems: string[] = []
    page.on("console", (m) => {
      const text = m.text()
      if (/Content Security Policy|Refused to/i.test(text)) problems.push(`CSP: ${text}`)
    })
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`))
    for (const host of [
      "https://dash.gezcez.com/**",
      "https://stats.example/**",
      "https://client.example/**",
      "https://www.gezcez.com/**",
    ]) {
      await page.route(host, (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: `<!doctype html><title>client</title><h1>client callback</h1>`,
        }),
      )
    }
    await use(page)
    expect(problems, problems.join("\n")).toEqual([])
  },
})

export { expect }

export async function enterEmail(page: Page, email: string) {
  await page.getByLabel("Email").fill(email)
  await page.getByRole("button", { name: "Continue" }).click()
}

export async function enterCode(page: Page, code: string) {
  const input = page.getByLabel("Code")
  await expect(input).toBeVisible()
  await input.fill(code)
}

/** Sign in through the UI with the mock's magic code. */
export async function signIn(page: Page, email = "ada@example.com") {
  await page.goto("/signin")
  await enterEmail(page, email)
  await enterCode(page, "123456")
  await expect(page).toHaveURL(/\/account/)
}
