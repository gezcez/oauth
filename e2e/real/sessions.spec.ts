import {
  clientResult,
  expect,
  newAccount,
  refreshAt,
  signInWithCode,
  startLogin,
  stubTurnstile,
  test,
} from "./fixtures"

test("two browsers on one account: revoke the other one, its refresh token stops working", async ({
  page,
  browser,
}) => {
  const email = await newAccount(page, "sessions")

  const other = await browser.newContext({
    locale: "en-GB",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  })
  await stubTurnstile(other)
  const phone = await other.newPage()
  await startLogin(phone)
  await signInWithCode(phone, email)
  const onPhone = await clientResult(phone)
  expect(onPhone.status).toBe("signed_in")
  expect((await refreshAt(phone, onPhone)).status).toBe(200)

  await page.goto("/account/sessions")
  const thisDevice = page.getByRole("listitem").filter({ hasText: "This device" })
  await expect(thisDevice).toHaveCount(1)
  const phoneCard = page.getByRole("listitem").filter({ hasText: "Safari on iOS" })
  await expect(phoneCard).toBeVisible()
  await expect(phoneCard).toContainText("E2E client")
  await phoneCard.getByRole("button", { name: "Sign out" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Sign out" }).click()
  await expect(page.getByText("Signed out of Safari on iOS.")).toBeVisible()
  await expect(phoneCard).toHaveCount(0)

  const refused = await refreshAt(phone, onPhone)
  expect(refused.status).toBe(400)
  expect(refused.body.error).toBe("invalid_grant")

  // The phone's identity session is gone too: the next login asks for an email again.
  await startLogin(phone)
  await expect(phone).toHaveURL(/\/signin\?req=/)
  await other.close()
})
