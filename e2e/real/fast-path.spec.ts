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

test("second login goes straight back to the client without rendering /signin", async ({ page }) => {
  const email = uniqueEmail("fast")
  await startLogin(page)
  await signInWithCode(page, email, { newAccount: true })
  const first = await clientResult(page)
  expect(first.status).toBe("signed_in")

  const visited: string[] = []
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) visited.push(f.url())
  })
  const started = Date.now()
  await startLogin(page)
  const second = await clientResult(page)
  const elapsed = Date.now() - started

  expect(second.status).toBe("signed_in")
  expect(second.claims?.sub).toBe(first.claims?.sub)
  // The oauth app only showed its /authorize spinner.
  const oauthPages = visited.filter((u) => u.startsWith(OAUTH)).map((u) => new URL(u).pathname)
  expect(
    oauthPages.every((p) => p === "/authorize"),
    oauthPages.join(", "),
  ).toBe(true)
  expect(visited.some((u) => u.startsWith(`${CLIENT}/done`))).toBe(true)
  // Generous bound: includes the test client's server-side token exchange and /v1/me.
  expect(elapsed).toBeLessThan(5_000)
})
