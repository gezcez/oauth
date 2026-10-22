import {
  CLIENT,
  clientResult,
  enterMailedCode,
  expect,
  mailCount,
  signInWithCode,
  startLogin,
  test,
  uniqueEmail,
} from "./fixtures"

test("max_age=1: the reauth screen confirms by code and the new token has a newer auth_time", async ({
  page,
}) => {
  const email = uniqueEmail("stepup")
  await startLogin(page)
  await signInWithCode(page, email, { newAccount: true })
  const first = await clientResult(page)
  expect(first.status).toBe("signed_in")

  await page.waitForTimeout(2_100)
  await startLogin(page, { max_age: "1" })
  await expect(page).toHaveURL(/\/reauth\?req=/)
  await expect(page.getByRole("heading", { name: "Confirm it's you" })).toBeVisible()
  await expect(page.getByText("E2E client needs you to sign in again")).toBeVisible()
  const before = await mailCount(page.request, email)
  await page.getByRole("button", { name: /Send a code to/ }).click()
  await enterMailedCode(page, email, before)

  const second = await clientResult(page)
  expect(second.status).toBe("signed_in")
  expect(second.claims?.sub).toBe(first.claims?.sub)
  expect(second.claims!.auth_time).toBeGreaterThan(first.claims!.auth_time)
})

test("account pages: a stale session goes through /reauth and comes back", async ({ page }) => {
  // Sign in, then age the session past the 10-minute sudo window by faking the clock in the
  // page: the app's own useSudo check sends the user to /reauth?return=...
  const email = uniqueEmail("sudo")
  await page.goto("/signin")
  await signInWithCode(page, email, { newAccount: true })
  await expect(page).toHaveURL(/\/account/)
  await page.clock.install({ time: Date.now() + 11 * 60_000 })
  await page.goto("/account/security")
  await page.getByRole("button", { name: "Add a password" }).click()
  await expect(page).toHaveURL(/\/reauth\?return=/)
  const before = await mailCount(page.request, email)
  await page.getByRole("button", { name: /Send a code to/ }).click()
  await enterMailedCode(page, email, before)
  await expect(page).toHaveURL(/\/account\/security/)
})

test("step-up popup: reauth in a popup, the client's callback page reports gz-step-up back", async ({
  page,
  context,
}) => {
  const email = uniqueEmail("popup")
  await startLogin(page)
  await signInWithCode(page, email, { newAccount: true })
  expect((await clientResult(page)).status).toBe("signed_in")
  await page.waitForTimeout(1_100)

  await page.goto(`${CLIENT}/opener`)
  const popupPromise = context.waitForEvent("page")
  await page.getByRole("button", { name: "Confirm it's you" }).click()
  const popup = await popupPromise
  await expect(popup).toHaveURL(/\/reauth\?req=/)
  const before = await mailCount(popup.request, email)
  await popup.getByRole("button", { name: /Send a code to/ }).click()
  await enterMailedCode(popup, email, before)
  await expect(page.locator("#messages")).toContainText('"type":"gz-step-up","ok":true')
  // COOP same-origin on the oauth app severs window.opener (see the test client's popupScript):
  // a client must not rely on postMessage to the opener for the step-up result.
  await expect(page.locator("#messages")).toContainText('"via":"broadcast"')
})
