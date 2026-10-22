import { clientResult, expect, signInWithCode, startLogin, test, uniqueEmail } from "./fixtures"

test("two accounts on one browser: select_account, use another account, chooser, switch", async ({
  page,
}) => {
  await startLogin(page)
  await signInWithCode(page, uniqueEmail("alice"), { newAccount: true, name: "Alice Chooser" })
  const alice = await clientResult(page)
  expect(alice.status).toBe("signed_in")

  // prompt=select_account always shows the chooser, even with one account.
  await startLogin(page, { prompt: "select_account" })
  await expect(page).toHaveURL(/\/choose\?req=/)
  await expect(page.getByRole("button", { name: /Alice Chooser/ })).toBeVisible()
  await page.getByRole("link", { name: "Use another account" }).click()
  await expect(page).toHaveURL(/\/signin\?req=/)
  await signInWithCode(page, uniqueEmail("bob"), { newAccount: true, name: "Bob Chooser" })
  const bob = await clientResult(page)
  expect(bob.status).toBe("signed_in")
  expect(bob.claims?.sub).not.toBe(alice.claims?.sub)

  // Two live accounts and no login_hint: the backend asks which one.
  await startLogin(page)
  await expect(page).toHaveURL(/\/choose\?req=/)
  await expect(page.getByRole("button", { name: /Bob Chooser/ })).toBeVisible()
  await page.getByRole("button", { name: /Alice Chooser/ }).click()
  const again = await clientResult(page)
  expect(again.status).toBe("signed_in")
  expect(again.claims?.sub).toBe(alice.claims?.sub)

  // Outside an OAuth request: the account menu switches the active account.
  await page.goto("/account")
  await expect(page.getByRole("heading", { name: "Hi, Alice Chooser" })).toBeVisible()
  await page.getByRole("button", { name: /Account menu for Alice Chooser/ }).click()
  await page.getByRole("menuitem", { name: "Switch account" }).click()
  await page.getByRole("button", { name: /Bob Chooser/ }).click()
  await expect(page.getByRole("heading", { name: "Hi, Bob Chooser" })).toBeVisible()
})
