import { expect, test } from "@playwright/test"
import { latestCode } from "../fixtures/mailbox"
import { startTestClient } from "../fixtures/test-client/server"

/**
 * Against the real backend image (docker-compose.e2e.yml). Runs only with E2E_REAL_BACKEND=1,
 * and is skipped until a backend image is published (e2e/backend-version = "unreleased").
 */
const OAUTH = process.env.E2E_OAUTH_URL ?? "https://oauth.localtest.me"
const API = process.env.E2E_API_URL ?? "https://api.localtest.me"

test.skip(process.env.E2E_REAL_BACKEND !== "1", "real-backend e2e is opt-in (E2E_REAL_BACKEND=1)")

let close: (() => void) | undefined
test.beforeAll(async () => {
  const server = await startTestClient({ oauthUrl: OAUTH, apiUrl: API })
  close = () => server.close()
})
test.afterAll(() => close?.())

test("PKCE round trip: authorize, email code, token exchange", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`
  await page.goto("http://localhost:4710/start?client_id=e2e_client")
  await expect(page).toHaveURL(/\/signin\?req=ar_/)
  const since = Date.now()
  await page.getByLabel("Email").fill(email)
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByLabel("Code").fill(await latestCode(API, email, since))
  await expect(page.getByRole("heading", { name: "Almost done" })).toBeVisible()
  await page.getByRole("checkbox", { name: /Terms of Use/ }).check()
  await page.getByRole("button", { name: "Create account" }).click()
  await page.waitForURL(/localhost:4710\/callback/)
  await expect(page.locator("#token")).toHaveText("ok")
})

test("third-party consent and cancel", async ({ page }) => {
  const email = `e2e-tp-${Date.now()}@example.com`
  await page.goto("http://localhost:4710/start?client_id=e2e_third_party")
  const since = Date.now()
  await page.getByLabel("Email").fill(email)
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByLabel("Code").fill(await latestCode(API, email, since))
  await page.getByRole("checkbox", { name: /Terms of Use/ }).check()
  await page.getByRole("button", { name: "Create account" }).click()
  await page.getByRole("button", { name: "Cancel" }).click()
  await page.waitForURL(/localhost:4710\/callback\?error=access_denied/)
})
