import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"
import { expect, signIn, test } from "../fixtures/app"

const publicPaths = [
  "/signin",
  "/signup",
  "/signin/password",
  "/reset",
  "/logout",
  "/signed-out",
  "/banned",
  "/error?code=OAUTH_INVALID_REDIRECT_URI",
  "/does-not-exist",
]
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

// Each test walks many screens; give it room when the suite runs in parallel.
test.describe.configure({ timeout: 120_000 })

async function audit(page: Page, label: string) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 })
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
    test(`axe: public screens, ${locale}, ${scheme} @desktop-only`, async ({ app: page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      await page.addInitScript((l) => localStorage.setItem("gz.locale", l), locale)
      for (const p of publicPaths) {
        await page.goto(p)
        await audit(page, `${p} ${locale} ${scheme}`)
      }
    })

    test(`axe: account screens, ${locale}, ${scheme} @desktop-only`, async ({ app: page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      await signIn(page, locale === "tr" ? "mert@example.com" : "ada@example.com")
      for (const p of accountPaths) {
        await page.goto(p)
        await audit(page, `${p} ${locale} ${scheme}`)
      }
    })
  }
}
