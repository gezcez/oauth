import { authorizePath, enterCode, enterEmail, expect, signIn, test } from "../fixtures/app"

test.describe("/authorize", () => {
  test("login, then back to the client with code and state, raw params dropped", async ({ app: page }) => {
    await page.goto(authorizePath())
    await expect(page).toHaveURL(/\/signin\?req=ar_/)
    await expect(page.getByText("Sign in to Dashboard")).toBeVisible()
    await enterEmail(page, "ada@example.com")
    await enterCode(page, "123456")
    await page.waitForURL(/^https:\/\/dash\.gezcez\.com\/auth\/callback\?code=.+&state=e2e-state$/)
  })

  test("fast path redirects without showing a form", async ({ app: page }) => {
    await signIn(page)
    const start = Date.now()
    await page.goto(authorizePath())
    await page.waitForURL(/^https:\/\/dash\.gezcez\.com\/auth\/callback\?code=/)
    expect(Date.now() - start).toBeLessThan(3000)
  })

  test("unregistered redirect URI shows /error and never navigates away", async ({ app: page }) => {
    let leftForEvil = false
    await page.route("https://evil.example/**", (r) => {
      leftForEvil = true
      return r.abort()
    })
    await page.goto(authorizePath({ redirect_uri: "https://evil.example/cb" }))
    await expect(page.getByRole("heading", { name: "This sign-in link is broken" })).toBeVisible()
    await expect(page).toHaveURL(/\/error\?code=OAUTH_INVALID_REDIRECT_URI/)
    await expect(page.getByText("evil.example")).toHaveCount(0)
    expect(leftForEvil).toBe(false)
  })

  test("unknown client shows /error", async ({ app: page }) => {
    await page.goto(authorizePath({ client_id: "nope" }))
    await expect(page.getByRole("heading", { name: "We don't know this app" })).toBeVisible()
  })

  test("reload on a sign-in step resumes the same request", async ({ app: page }) => {
    await page.goto(authorizePath())
    await expect(page).toHaveURL(/\/signin\?req=ar_/)
    await page.reload()
    await expect(page.getByText("Sign in to Dashboard")).toBeVisible()
  })

  test("third-party consent: cancel gives access_denied, allow gives a code", async ({ app: page }) => {
    await signIn(page, "mert@example.com")
    const consent = authorizePath({
      client_id: "e2e_third_party",
      redirect_uri: "https://stats.example/callback",
      scope: "openid profile transit",
    })
    await page.goto(consent)
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Transit Stats")
    await page
      .getByRole("button", { name: "Vazgeç" })
      .or(page.getByRole("button", { name: "Cancel" }))
      .click()
    await page.waitForURL(/stats\.example\/callback\?error=access_denied/)
    await page.goto(consent)
    await page
      .getByRole("button", { name: "İzin ver" })
      .or(page.getByRole("button", { name: "Allow" }))
      .click()
    await page.waitForURL(/stats\.example\/callback\?code=/)
  })

  test("chooser: two accounts, prompt=select_account, pick one", async ({ app: page }) => {
    await signIn(page, "mert@example.com")
    await signIn(page, "ada@example.com")
    await page.goto(authorizePath({ prompt: "select_account" }))
    await expect(page.getByRole("heading", { name: "Choose an account" })).toBeVisible()
    await page.getByRole("button", { name: /Mert Yılmaz/ }).click()
    await page.waitForURL(/dash\.gezcez\.com\/auth\/callback\?code=/)
  })

  test("step-up with max_age re-authenticates", async ({ app: page }) => {
    await signIn(page)
    await page.waitForTimeout(1100)
    await page.goto(authorizePath({ max_age: "1" }))
    await expect(page.getByRole("heading", { name: "Confirm it's you" })).toBeVisible()
    await page.getByRole("button", { name: /Use password/ }).click()
    await page.getByLabel("Password", { exact: true }).fill("correct horse battery")
    await page.getByRole("button", { name: "Confirm" }).click()
    await page.waitForURL(/dash\.gezcez\.com\/auth\/callback\?code=/)
  })

  test("ui_locales=tr switches the language for this visit", async ({ app: page }) => {
    await page.goto(authorizePath({ ui_locales: "tr" }))
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Giriş yap")
  })
})

test.describe("logout", () => {
  test("registered post-logout URI ends the session and returns", async ({ app: page }) => {
    await signIn(page)
    await page.goto(
      "/logout?client_id=dashboard&post_logout_redirect_uri=https%3A%2F%2Fdash.gezcez.com%2Fauth%2Flogged-out&state=s1",
    )
    await page.waitForURL("https://dash.gezcez.com/auth/logged-out?state=s1")
    await page.goto("/account")
    await expect(page).toHaveURL(/\/signin\?return=%2Faccount/)
  })

  test("unregistered URI asks first", async ({ app: page }) => {
    await signIn(page)
    await page.goto("/logout?client_id=dashboard&post_logout_redirect_uri=https%3A%2F%2Fevil.example%2F")
    await expect(page.getByRole("heading", { name: "Sign out of gezcez on this browser?" })).toBeVisible()
    await page.getByRole("button", { name: "Sign out", exact: true }).click()
    await expect(page.getByRole("heading", { name: "You're signed out" })).toBeVisible()
  })
})
