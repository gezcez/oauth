import type { Page } from "@playwright/test"
import {
  PASSWORD,
  addPassword,
  clientResult,
  expect,
  newAccount,
  signOut,
  startLogin,
  test,
  uniqueEmail,
} from "./fixtures"

async function passwordForm(page: Page, email: string, password: string) {
  await page.getByRole("link", { name: "Use a password instead" }).click()
  await expect(page).toHaveURL(/\/signin\/password/)
  await expect(page.getByRole("heading", { name: "Sign in with a password" })).toBeVisible()
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await expect(page.getByLabel("Email")).toHaveValue(email)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
}

test("add a password, sign out, sign in with it; wrong password and unknown email look the same", async ({
  page,
}) => {
  const email = await newAccount(page, "pwd")
  await addPassword(page)
  await signOut(page)

  await startLogin(page)
  await passwordForm(page, email, "not the password at all")
  const wrong = page.getByRole("alert").filter({ hasText: /password/i })
  await expect(wrong).toBeVisible()
  const wrongText = await wrong.textContent()

  await page.goto("/signin")
  await passwordForm(page, uniqueEmail("nobody"), PASSWORD)
  const unknown = page.getByRole("alert").filter({ hasText: /password/i })
  await expect(unknown).toBeVisible()
  expect(await unknown.textContent()).toBe(wrongText)

  await startLogin(page)
  await passwordForm(page, email, PASSWORD)
  const result = await clientResult(page)
  expect(result.status).toBe("signed_in")
  expect(result.claims?.amr).toContain("pwd")
})
