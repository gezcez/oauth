import { API, expect, newAccount, signInWithCode, test } from "./fixtures"

test("privacy toggles persist", async ({ page }) => {
  await newAccount(page, "privacy")
  await page.goto("/account/privacy")
  const emails = page.getByRole("switch", { name: "Product emails" })
  const location = page.getByRole("switch", { name: "Location history" })
  await expect(location).not.toBeChecked()
  const wasEmails = await emails.isChecked()
  await location.click()
  await expect(page.getByText("Saved.").first()).toBeVisible()
  await emails.click()
  await page.reload()
  await expect(location).toBeChecked()
  await expect(emails).toBeChecked({ checked: !wasEmails })
})

// The backend rewrite branch has no /v1/account/export or /v1/account/delete yet (oauth.md 4.4).
// These run as soon as it does; until then they are reported as fixme, not skipped silently.
test.describe("data export and account deletion", () => {
  test.beforeEach(async ({ request }) => {
    const probe = await request.post(`${API}/v1/account/delete/cancel`)
    test.fixme(
      probe.status() === 404,
      "backend: /v1/account/export and /v1/account/delete are not implemented",
    )
  })

  test("export request appears in the list", async ({ page }) => {
    await newAccount(page, "export")
    await page.goto("/account/privacy")
    await page.getByRole("button", { name: "Request a copy" }).click()
    await expect(page.getByText("We're preparing your data.")).toBeVisible()
    await expect(page.getByText("Preparing")).toBeVisible()
  })

  test("deletion schedules, blocks sign-in with the pending page, and cancel keeps the account", async ({
    page,
  }) => {
    const email = await newAccount(page, "delete")
    await page.goto("/account/privacy/delete")
    await page.getByLabel("Type your email to confirm").fill(email)
    await page.getByRole("button", { name: "Delete my account" }).click()
    await expect(page.getByRole("heading", { name: "Your account will be deleted" })).toBeVisible()

    await page.goto("/signin")
    await signInWithCode(page, email)
    await expect(page.getByRole("heading", { name: "Your account is scheduled for deletion" })).toBeVisible()
    await page.getByRole("button", { name: "Keep my account" }).click()
    await expect(page).toHaveURL(/\/account/)
  })
})
