import { enterCode, enterEmail, expect, test } from "../fixtures/app"

test.describe("sign in and sign up", () => {
  test("new address: code, profile, account with welcome", async ({ app: page }) => {
    await page.goto("/signup")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Create your gezcez account")
    await enterEmail(page, "grace.hopper@example.com")
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible()
    await expect(page.getByText("g***@example.com")).toBeVisible()
    await enterCode(page, "123456")
    await expect(page.getByRole("heading", { name: "Almost done" })).toBeVisible()
    await expect(page.getByLabel("Display name")).toHaveValue("Grace Hopper")
    await page.getByRole("checkbox", { name: /Terms of Use/ }).check()
    await page.getByRole("button", { name: "Create account" }).click()
    await expect(page).toHaveURL(/\/account$/)
    await expect(page.getByText("Welcome to gezcez. Your account is ready.")).toBeVisible()
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi, Grace Hopper")
  })

  test("pasting the code auto-submits", async ({ app: page, context, browserName }) => {
    test.skip(browserName !== "chromium", "clipboard permissions are Chromium-only in Playwright")
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    await page.goto("/signin")
    await enterEmail(page, "ada@example.com")
    await page.evaluate(() => navigator.clipboard.writeText("123456"))
    await page.getByLabel("Code").focus()
    await page.keyboard.press("ControlOrMeta+V")
    await expect(page).toHaveURL(/\/account$/)
  })

  test("wrong, expired and resend", async ({ app: page }) => {
    await page.goto("/signin")
    await enterEmail(page, "ada@example.com")
    await enterCode(page, "999999")
    await expect(page.getByText("That code is not right. You have 4 tries left.")).toBeVisible()
    await expect(page.getByLabel("Code")).toHaveValue("")
    await expect(page.getByLabel("Code")).toBeFocused()
    await expect(page.getByText(/resend in 0:\d\d/)).toBeVisible()
    await enterCode(page, "000000")
    await expect(page.getByText("This code has expired. We can send you a new one.")).toBeVisible()
  })

  test("rate limit shows a countdown and keeps the form value", async ({ app: page }) => {
    await page.goto("/signin")
    await enterEmail(page, "ratelimit@example.com")
    const btn = page.getByRole("button", { name: /Try again in 1:1\d/ })
    await expect(btn).toBeDisabled()
    await expect(page.getByLabel("Email")).toHaveValue("ratelimit@example.com")
  })

  test("sixth code request in an hour is rate limited", async ({ app: page }) => {
    for (let i = 0; i < 5; i++) {
      await page.goto("/signin")
      await enterEmail(page, "often@example.com")
      await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible()
    }
    await page.goto("/signin")
    await enterEmail(page, "often@example.com")
    await expect(page.getByRole("button", { name: /Try again in \d+ minutes/ })).toBeDisabled()
  })

  test("password: generic error for wrong password and unknown email, then success", async ({
    app: page,
  }) => {
    await page.goto("/signin/password")
    await page.getByLabel("Email").fill("ada@example.com")
    await page.getByLabel("Password", { exact: true }).fill("not it")
    await page.getByRole("button", { name: "Sign in" }).click()
    const msg = page.getByText(/Email or password is not right/)
    await expect(msg).toBeVisible()
    const first = await msg.textContent()
    await page.getByLabel("Email").fill("nobody@example.com")
    await page.getByLabel("Password", { exact: true }).fill("whatever-it-is")
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue("")
    await expect(msg).toHaveText(first!)
    await page.getByLabel("Email").fill("ada@example.com")
    await page.getByLabel("Password", { exact: true }).fill("correct horse battery")
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/account$/)
  })

  test("password reset with a code", async ({ app: page }) => {
    await page.goto("/signin/password")
    await page.getByRole("link", { name: "Forgot password?" }).click()
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible()
    await enterEmail(page, "ada@example.com")
    await enterCode(page, "123456")
    await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible()
    await page.getByLabel("New password").fill("a brand new pass phrase")
    await expect(page.getByText(/Strength: Strong/)).toBeVisible()
    await page.getByRole("button", { name: "Set password" }).click()
    await expect(page).toHaveURL(/\/account\/security$/)
    await expect(page.getByText("Your password was changed.")).toBeVisible()
  })

  test("banned account after the code", async ({ app: page }) => {
    await page.goto("/signin")
    await enterEmail(page, "banned@example.com")
    await enterCode(page, "123456")
    await expect(page.getByRole("heading", { name: "This account can't sign in" })).toBeVisible()
    await expect(page.getByText("Repeated abuse of the report feature.")).toBeVisible()
  })

  test("language switch translates the screen and is remembered", async ({ app: page }) => {
    await page.goto("/signin")
    await page.getByRole("button", { name: "Türkçe" }).click()
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Giriş yap")
    await expect(page.locator("html")).toHaveAttribute("lang", "tr")
    await page.reload()
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Giriş yap")
  })

  test("keyboard only: tab to the field, type, submit with Enter", async ({ app: page }) => {
    await page.goto("/signin")
    await expect(page.getByLabel("Email")).toBeFocused()
    await page.keyboard.type("ada@example.com")
    await page.keyboard.press("Enter")
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeFocused()
  })
})
