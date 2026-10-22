import { API, OAUTH, enterEmail, expect, test, uniqueEmail } from "./fixtures"

/** Backend preset "email-code-send": 5 codes per email per hour, times RATE_LIMIT_SCALE. */
const PER_EMAIL = 5 * Number(process.env.E2E_RATE_LIMIT_SCALE ?? "10")

test("one code request over the per-email limit shows a countdown and keeps the email", async ({ page }) => {
  const email = uniqueEmail("ratelimit")
  await page.goto("/signin")
  // Use up the limit through the API with this browser's own device cookie and CSRF token.
  const csrf = await page.request.get(`${API}/v1/account/csrf`)
  const { data } = (await csrf.json()) as { data: { token: string } }
  for (let i = 0; i < PER_EMAIL; i++) {
    const res = await page.request.post(`${API}/v1/account/email/start`, {
      headers: { "X-CSRF-Token": data.token, Origin: OAUTH },
      data: { email, intent: "signin", locale: "en" },
    })
    expect(res.status(), await res.text()).toBe(202)
  }

  await enterEmail(page, email)
  await expect(page.getByRole("button", { name: /Try again in/ })).toBeDisabled()
  await expect(page.getByLabel("Email")).toHaveValue(email)
  await expect(page).toHaveURL(/\/signin$/)
})
