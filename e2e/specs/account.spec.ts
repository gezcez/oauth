import { expect, signIn, test } from "../fixtures/app"

test.describe("account pages", () => {
  test("deep link to deletion page goes through sign-in and back", async ({ app: page }) => {
    await page.goto("/account/privacy/delete")
    await expect(page).toHaveURL(/\/signin\?return=%2Faccount%2Fprivacy%2Fdelete/)
    await page.getByLabel("Email").fill("ada@example.com")
    await page.getByRole("button", { name: "Continue" }).click()
    await page.getByLabel("Code").fill("123456")
    await expect(page).toHaveURL(/\/account\/privacy\/delete$/)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Delete your account")
  })

  test("profile name change shows in the header menu", async ({ app: page }) => {
    await signIn(page)
    await page.getByRole("link", { name: "Profile" }).click()
    await page.getByLabel("Display name").fill("Ada King")
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText("Your profile was saved.")).toBeVisible()
    await expect(page.getByRole("button", { name: /Account menu for Ada King/ })).toBeVisible()
  })

  test("devices: sign out one, then all others", async ({ app: page }) => {
    await signIn(page)
    await page.goto("/account/sessions")
    await expect(page.getByText("This device")).toBeVisible()
    const card = page.getByRole("listitem").filter({ hasText: "Chrome on Windows" })
    await card.getByRole("button", { name: "Sign out" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Sign out" }).click()
    await expect(page.getByText("Signed out of Chrome on Windows.")).toBeVisible()
    await page.getByRole("button", { name: "Sign out of all other devices" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Sign out of all other devices" }).click()
    await expect(page.getByText("Signed out of 1 other device.")).toBeVisible()
  })

  test("connected apps: remove access", async ({ app: page }) => {
    await signIn(page)
    await page.goto("/account/apps")
    await expect(page.getByText("Made by gezcez").first()).toBeVisible()
    const card = page.getByRole("listitem").filter({ hasText: "Transit Stats" })
    await card.getByRole("button", { name: "Remove access" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Remove access" }).click()
    await expect(page.getByText("Transit Stats no longer has access.")).toBeVisible()
  })

  test("security: stale session re-auths before removing the password", async ({ app: page }) => {
    await signIn(page)
    await page.evaluate(() => {
      const db = JSON.parse(sessionStorage.getItem("gz.mock.db")!)
      const s = db.sessions.find((x: { id: string }) => x.id === db.active_session)
      s.auth_time = Date.now() - 3600_000
      sessionStorage.setItem("gz.mock.db", JSON.stringify(db))
    })
    await page.goto("/account/security")
    await page.getByRole("button", { name: "Remove password" }).click()
    await expect(page).toHaveURL(/\/reauth\?return=%2Faccount%2Fsecurity/)
    await page.getByRole("button", { name: /Send a code/ }).click()
    await page.getByLabel("Code").fill("123456")
    await expect(page).toHaveURL(/\/account\/security$/)
    await page.getByRole("button", { name: "Remove password" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Remove password" }).click()
    await expect(page.getByText("Your password was removed.")).toBeVisible()
    await expect(
      page.getByText("You don't have a password. That's fine: email codes are enough."),
    ).toBeVisible()
  })

  test("privacy: toggle, request export, download", async ({ app: page }) => {
    await signIn(page)
    await page.goto("/account/privacy")
    const toggle = page.getByRole("switch", { name: "Location history" })
    await expect(toggle).toHaveAttribute("aria-checked", "false")
    await toggle.click()
    await expect(toggle).toHaveAttribute("aria-checked", "true")
    await page.getByRole("button", { name: "Request a copy" }).click()
    await expect(page.getByText("We're preparing your data.")).toBeVisible()
    await expect(page.getByText("Preparing", { exact: true }).first()).toBeVisible()
    const download = page.waitForEvent("download")
    await page.getByRole("button", { name: "Download" }).first().click()
    expect((await download).suggestedFilename()).toMatch(/^gezcez-export-.+\.zip$/)
  })

  test("deletion: schedule, sign-in shows pending page, keep the account", async ({ app: page }) => {
    await signIn(page)
    await page.goto("/account/privacy/delete")
    await page.getByLabel("Type your email to confirm").fill("ada@example.com")
    await page.getByRole("button", { name: "Delete my account" }).click()
    await expect(page.getByRole("heading", { name: "Your account will be deleted" })).toBeVisible()
    await page.goto("/signin")
    await page.getByLabel("Email").fill("ada@example.com")
    await page.getByRole("button", { name: "Continue" }).click()
    await page.getByLabel("Code").fill("123456")
    await expect(page.getByRole("heading", { name: "Your account is scheduled for deletion" })).toBeVisible()
    await page.getByRole("button", { name: "Keep my account" }).click()
    await expect(page).toHaveURL(/\/account$/)
  })

  test("language page saves the account language", async ({ app: page }) => {
    await signIn(page)
    await page.goto("/account/language")
    await page.getByRole("radio", { name: "Türkçe" }).click()
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dil")
    await expect(page.getByText("Dil kaydedildi.")).toBeVisible()
  })

  test("switch account from the menu @desktop-only", async ({ app: page }) => {
    await signIn(page, "mert@example.com")
    await signIn(page, "ada@example.com")
    await page.getByRole("button", { name: /Account menu for Ada Lovelace/ }).click()
    await page.getByRole("menuitem", { name: "Switch account" }).click()
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Mert Yılmaz/ })
      .click()
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Merhaba, Mert Yılmaz")
  })

  test("sign out of this device from the menu", async ({ app: page }) => {
    await signIn(page)
    await page.getByRole("button", { name: /Account menu for/ }).click()
    await page.getByRole("menuitem", { name: /Sign out of this device/ }).click()
    await expect(page.getByRole("heading", { name: "You're signed out" })).toBeVisible()
  })
})
