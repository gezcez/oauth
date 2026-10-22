import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"
import { en } from "../../src/i18n/en"
import { tr } from "../../src/i18n/tr"
import { clientResult, expect, mailCount, startLogin, test, uniqueEmail, waitForMail } from "./fixtures"

const accountPaths = [
  "/account",
  "/account/profile",
  "/account/email",
  "/account/sessions",
  "/account/apps",
  "/account/security",
  "/account/privacy",
  "/account/privacy/delete",
  "/account/language",
]

test.describe.configure({ timeout: 180_000 })

async function audit(page: Page, label: string) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze()
  const summary = results.violations.map(
    (v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  )
  expect(summary, summary.join("\n")).toEqual([])
}

for (const scheme of ["light", "dark"] as const) {
  for (const locale of ["en", "tr"] as const) {
    const L = locale === "tr" ? tr : en
    test(`axe on every screen with real data, ${locale}, ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      await page.addInitScript((l) => localStorage.setItem("gz.locale", l), locale)
      const email = uniqueEmail(`a11y-${locale}-${scheme}`)
      const tag = `${locale} ${scheme}`

      await startLogin(page, { client: "e2e_third_party", ui_locales: locale })
      await audit(page, `signin ${tag}`)
      await page.getByLabel(L.auth.email.label).fill(email)
      await page.getByRole("button", { name: L.common.continue }).click()
      await expect(page.getByLabel(L.auth.code.label)).toBeVisible()
      await audit(page, `code ${tag}`)
      const mail = await waitForMail(page.request, email)
      await page.getByLabel(L.auth.code.label).fill(mail.code!)

      await expect(page).toHaveURL(/\/signup\/profile/)
      await audit(page, `profile ${tag}`)
      await page.getByLabel(L.auth.profile.nameLabel).fill("A11y Person")
      await page.locator("#terms").check()
      await page.getByRole("button", { name: L.auth.profile.submit }).click()

      await expect(page).toHaveURL(/\/consent/)
      await audit(page, `consent ${tag}`)
      await page.getByRole("button", { name: L.auth.consent.allow }).click()
      expect((await clientResult(page)).status).toBe("signed_in")

      await startLogin(page, { prompt: "select_account", ui_locales: locale })
      await expect(page).toHaveURL(/\/choose/)
      await audit(page, `choose ${tag}`)

      await startLogin(page, { max_age: "0", ui_locales: locale })
      await expect(page).toHaveURL(/\/reauth/)
      await audit(page, `reauth ${tag}`)

      for (const path of accountPaths) {
        await page.goto(path)
        await audit(page, `${path} ${tag}`)
      }

      await startLogin(page, { redirect_uri: "https://evil.example/callback", ui_locales: locale })
      await expect(page).toHaveURL(/\/error/)
      await audit(page, `error ${tag}`)

      await page.goto("/logout")
      await audit(page, `logout ${tag}`)
      expect(await mailCount(page.request, email)).toBe(1)
    })
  }
}
