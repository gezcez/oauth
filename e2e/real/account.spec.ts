import {
  clientResult,
  enterMailedCode,
  expect,
  newAccount,
  signInWithCode,
  startLogin,
  test,
  uniqueEmail,
} from "./fixtures"

test("profile, language, devices, connected apps and security events read and write the real API", async ({
  page,
}) => {
  await startLogin(page)
  await signInWithCode(page, uniqueEmail("account"), { newAccount: true, name: "Ada Account" })
  expect((await clientResult(page)).status).toBe("signed_in")

  await page.goto("/account")
  await expect(page.getByRole("heading", { name: "Hi, Ada Account" })).toBeVisible()

  await page.goto("/account/profile")
  await page.getByLabel("Display name").fill("Ada Renamed")
  await page.getByRole("button", { name: "Save" }).click()
  await expect(page.getByText("Your profile was saved.")).toBeVisible()
  await page.reload()
  await expect(page.getByLabel("Display name")).toHaveValue("Ada Renamed")
  await expect(page.getByRole("button", { name: /Account menu for Ada Renamed/ })).toBeVisible()

  await page.goto("/account/sessions")
  const current = page.getByRole("listitem").filter({ hasText: "This device" })
  await expect(current).toHaveCount(1)
  await expect(current).toContainText("E2E client")

  await page.goto("/account/apps")
  const app = page.getByRole("listitem").filter({ hasText: "E2E client" })
  await expect(app).toBeVisible()
  await expect(app).toContainText("Made by gezcez")

  await page.goto("/account/security")
  await expect(page.getByText("You don't have a password.")).toBeVisible()
  await expect(page.getByRole("region", { name: "Recent security activity" })).toContainText(
    "Account created",
  )

  await page.goto("/account/language")
  await page.getByRole("radio", { name: "Türkçe" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Dil" })).toBeVisible()
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  // The locale comes back from the profile, not only from local storage.
  await expect(page.getByRole("radio", { name: "Türkçe" })).toBeChecked()
})

test("email change: sudo, code to the new address, profile shows it", async ({ page }) => {
  await newAccount(page, "change")
  const next = uniqueEmail("changed")
  await page.goto("/account/email")
  await page.getByRole("button", { name: "Change email" }).click()
  await page.getByLabel("New email").fill(next)
  await page.getByRole("button", { name: "Send code" }).click()
  await enterMailedCode(page, next)
  await expect(page.getByText(`Your email is now ${next}`)).toBeVisible()
})
