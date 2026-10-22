import { clientResult, expect, refreshAt, signInWithCode, startLogin, test, uniqueEmail } from "./fixtures"

test("third-party consent: deny gives access_denied, allow signs in, removing access kills refresh", async ({
  page,
}) => {
  await startLogin(page, { client: "e2e_third_party" })
  await signInWithCode(page, uniqueEmail("consent"), { newAccount: true })

  await expect(page).toHaveURL(/\/consent\?req=/)
  await expect(
    page.getByRole("heading", { name: "E2E third party wants to access your gezcez account" }),
  ).toBeVisible()
  await expect(page.getByText("Not made by gezcez")).toBeVisible()
  await page.getByRole("button", { name: "Cancel" }).click()
  const denied = await clientResult(page)
  expect(denied.status).toBe("error")
  expect(denied.error).toBe("access_denied")

  await startLogin(page, { client: "e2e_third_party" })
  await expect(page).toHaveURL(/\/consent\?req=/)
  await page.getByRole("button", { name: "Allow" }).click()
  const allowed = await clientResult(page)
  expect(allowed.status).toBe("signed_in")
  expect(allowed.claims?.aud).toBe("e2e_third_party")

  // The grant is remembered: no consent screen the second time.
  await startLogin(page, { client: "e2e_third_party" })
  expect((await clientResult(page)).status).toBe("signed_in")

  const ok = await refreshAt(page, allowed)
  expect(ok.status).toBe(200)

  await page.goto("/account/apps")
  const card = page.getByRole("listitem").filter({ hasText: "E2E third party" })
  await expect(card).toBeVisible()
  await card.getByRole("button", { name: "Remove access" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Remove access" }).click()
  await expect(page.getByText("E2E third party no longer has access.")).toBeVisible()

  const refused = await refreshAt(page, allowed)
  expect(refused.status).toBe(400)
  expect(refused.body.error).toBe("invalid_grant")
})
