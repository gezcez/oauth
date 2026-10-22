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

test("@mobile new email: code from the mailbox, profile, redirect back, PKCE exchange, /v1/me", async ({
  page,
}) => {
  const email = uniqueEmail("signup")
  await startLogin(page)
  await expect(page).toHaveURL(new RegExp(`^${OAUTH}/signin\\?req=ar_`))
  await expect(page.getByText("E2E client")).toBeVisible()

  await signInWithCode(page, email, { newAccount: true })

  const result = await clientResult(page)
  expect(result.status, JSON.stringify(result.token_error)).toBe("signed_in")
  expect(result.client_id).toBe("e2e_client")
  expect(result.claims?.aud).toBe("e2e_client")
  expect(result.claims?.amr).toContain("otp")
  expect(result.tokens?.refresh_token).toBeTruthy()
  expect(result.me?.status).toBe(200)
  const user = result.me?.body.data?.user as { id: string; display_name: string } | undefined
  expect(user?.id).toBe(result.claims?.sub)
  expect(user?.display_name).toBe("E2E Person")
  // The address bar no longer holds the authorization code.
  expect(page.url()).toMatch(new RegExp(`^${CLIENT}/done\\?txn=`))
  expect(page.url()).not.toContain("code=")
})
