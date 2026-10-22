import {
  CLIENT,
  OAUTH,
  clientResult,
  expect,
  signInWithCode,
  startLogin,
  test,
  uniqueEmail,
} from "./fixtures"

test("RP-initiated logout with the registered URI ends the session and returns with state", async ({
  page,
}) => {
  await startLogin(page)
  await signInWithCode(page, uniqueEmail("logout"), { newAccount: true })
  expect((await clientResult(page)).status).toBe("signed_in")

  await page.goto(`${CLIENT}/logout?state=bye-123`)
  await expect(page).toHaveURL(`${CLIENT}/?state=bye-123`)

  await startLogin(page)
  await expect(page).toHaveURL(new RegExp(`^${OAUTH}/signin\\?req=`))
})

test("an unregistered post-logout URI ends nothing until the user confirms", async ({ page }) => {
  await startLogin(page)
  await signInWithCode(page, uniqueEmail("logout2"), { newAccount: true })
  expect((await clientResult(page)).status).toBe("signed_in")

  await page.goto(`${CLIENT}/logout?post_logout_redirect_uri=${encodeURIComponent(`${CLIENT}/elsewhere`)}`)
  await expect(page.getByRole("heading", { name: "Sign out of gezcez on this browser?" })).toBeVisible()
  expect(page.url()).toMatch(new RegExp(`^${OAUTH}/logout`))

  // Still signed in: cancelling keeps the session.
  const session = await page.request.get(`${process.env.E2E_API_URL}/v1/account/session`)
  expect(session.status()).toBe(200)

  await page.getByRole("button", { name: "Sign out", exact: true }).click()
  await expect(page).toHaveURL(/\/signed-out/)
  await expect(page.getByRole("heading", { name: "You're signed out" })).toBeVisible()
  const after = await page.request.get(`${process.env.E2E_API_URL}/v1/account/session`)
  expect(after.status()).toBe(401)
})
