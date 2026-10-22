import {
  addPassword,
  clientResult,
  enterMailedCode,
  expect,
  mailCount,
  newAccount,
  signOut,
  startLogin,
  test,
} from "./fixtures"

test("forgot password: code by email, new password, signed in, old password stops working", async ({
  page,
}) => {
  const email = await newAccount(page, "reset")
  await addPassword(page, "first password 1234")
  await signOut(page)

  await page.goto("/signin/password")
  await page.getByRole("link", { name: "Forgot password?" }).click()
  await expect(page).toHaveURL(/\/reset/)
  const before = await mailCount(page.request, email)
  await page.getByLabel("Email").fill(email)
  await page.getByRole("button", { name: "Continue" }).click()
  await enterMailedCode(page, email, before)
  await expect(page).toHaveURL(/\/reset\/new/)
  await page.getByLabel("New password").fill("second password 5678")
  await page.getByRole("button", { name: "Set password" }).click()
  await expect(page).toHaveURL(/\/account\/security/)

  await signOut(page)
  await startLogin(page)
  await page.getByRole("link", { name: "Use a password instead" }).click()
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill("first password 1234")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page.getByRole("alert").filter({ hasText: /password/i })).toBeVisible()
  await page.getByLabel("Password", { exact: true }).fill("second password 5678")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  expect((await clientResult(page)).status).toBe("signed_in")
})
