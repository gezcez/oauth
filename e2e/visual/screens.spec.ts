import type { Page } from "@playwright/test"
import type { Locale } from "../../src/i18n/types"
import { authorizePath, expect } from "../fixtures/app"
import { setAccountLocale, settle, test, tFor, type Scheme } from "./stable"

/**
 * Visual regression: every screen from screens/oauth in light and dark, en and tr, against the mock
 * build. Projects `visual-desktop` and `visual-mobile` (VISUAL=1). Baselines live in
 * e2e/visual/__screenshots__/<project>/<screen>-<locale>-<scheme>.png.
 *
 *   bun run visual          compare against the committed baselines
 *   bun run visual:update   rewrite the baselines after an intended UI change
 *
 * The steps below never match on English text, so the same steps drive both languages: inputs are
 * found by type, and waits that need copy read it from the app's own catalogs.
 */

type Ctx = { page: Page; locale: Locale; t: ReturnType<typeof tFor> }
type Screen = {
  name: string
  /** Defaults to both. Screens whose language is fixed by the account are captured once. */
  locales?: readonly Locale[]
  go: (c: Ctx) => Promise<void>
}

const h1 = (page: Page, name?: string | RegExp) =>
  expect(page.getByRole("heading", { level: 1, ...(name ? { name } : {}) })).toBeVisible({ timeout: 15_000 })

async function enterEmail(page: Page, email: string) {
  const input = page.locator('input[type="email"]')
  await input.fill(email)
  await page.locator("form", { has: input }).locator('button[type="submit"]').click()
}

async function enterCode(page: Page, code: string) {
  const input = page.locator('input[autocomplete="one-time-code"]')
  await expect(input).toBeVisible()
  await input.fill(code)
}

/** Sign in through the UI with the mock's magic code, then wait for the account overview. */
async function signIn(page: Page, email = "ada@example.com") {
  await page.goto("/signin")
  await enterEmail(page, email)
  await enterCode(page, "123456")
  await expect(page).toHaveURL(/\/account/)
  await settle(page)
}

const accountScreen = (name: string, path: string): Screen => ({
  name,
  go: async ({ page, locale }) => {
    await signIn(page)
    // Account pages follow the account's saved language, so give Ada the language under test.
    await setAccountLocale(page, "ada@example.com", locale)
    await page.goto(path)
    await h1(page)
  },
})

const screens: Screen[] = [
  {
    name: "01-signin",
    go: async ({ page }) => {
      await page.goto("/signin")
      await h1(page)
    },
  },
  {
    name: "02-signin-client",
    go: async ({ page, t }) => {
      await page.goto(authorizePath())
      await expect(page.getByText(t("auth.eyebrow.signinTo", { client: "Dashboard" }))).toBeVisible()
    },
  },
  {
    name: "03-code",
    go: async ({ page }) => {
      await page.goto("/signin")
      await enterEmail(page, "ada@example.com")
      await expect(page.locator('input[autocomplete="one-time-code"]')).toBeVisible()
    },
  },
  {
    name: "04-code-error",
    go: async ({ page, t }) => {
      await page.goto("/signin")
      await enterEmail(page, "ada@example.com")
      await enterCode(page, "999999")
      await expect(page.getByText(t("errors.AUTH_CODE_INVALID")).first()).toBeVisible()
    },
  },
  {
    name: "05-password",
    go: async ({ page }) => {
      await page.goto("/signin/password")
      await h1(page)
    },
  },
  {
    name: "06-signup",
    go: async ({ page }) => {
      await page.goto("/signup")
      await h1(page)
    },
  },
  {
    name: "07-signup-profile",
    go: async ({ page, t }) => {
      await page.goto("/signup")
      await enterEmail(page, "grace.hopper@example.com")
      await enterCode(page, "123456")
      await h1(page, t("auth.profile.title"))
    },
  },
  {
    name: "08-rate-limited",
    go: async ({ page, t }) => {
      await page.goto("/signin")
      await enterEmail(page, "ratelimit@example.com")
      const label = t("auth.rateLimit.button", { time: "__" }).split("__")[0]!.trim()
      await expect(page.getByRole("button", { name: label })).toBeVisible()
    },
  },
  {
    name: "09-reset",
    go: async ({ page }) => {
      await page.goto("/reset")
      await h1(page)
    },
  },
  {
    name: "10-chooser",
    go: async ({ page, t }) => {
      await signIn(page, "mert@example.com")
      await signIn(page, "ada@example.com")
      await page.goto(authorizePath({ prompt: "select_account" }))
      await h1(page, t("auth.choose.title"))
    },
  },
  {
    name: "11-consent",
    go: async ({ page, t }) => {
      await signIn(page)
      await page.goto(
        authorizePath({
          client_id: "e2e_third_party",
          redirect_uri: "https://stats.example/callback",
          scope: "openid profile transit",
        }),
      )
      await expect(page.getByRole("button", { name: t("auth.consent.allow"), exact: true })).toBeVisible()
    },
  },
  {
    name: "12-reauth",
    go: async ({ page, t }) => {
      await signIn(page)
      await page.goto("/reauth?return=%2Faccount%2Fsecurity")
      await h1(page, t("auth.reauth.title"))
    },
  },
  {
    name: "13-logout-confirm",
    go: async ({ page }) => {
      await signIn(page)
      await page.goto("/logout")
      await h1(page)
    },
  },
  {
    name: "14-signed-out",
    go: async ({ page }) => {
      await page.goto("/signed-out")
      await h1(page)
    },
  },
  {
    name: "15-banned",
    go: async ({ page, t }) => {
      await page.goto("/signin")
      await enterEmail(page, "banned@example.com")
      await enterCode(page, "123456")
      await h1(page, t("auth.banned.title"))
    },
  },
  {
    name: "16-pending-deletion",
    go: async ({ page, t }) => {
      await page.goto("/signin")
      await enterEmail(page, "deleting@example.com")
      await enterCode(page, "123456")
      await h1(page, t("auth.pendingDeletion.title"))
    },
  },
  {
    name: "17-error",
    go: async ({ page }) => {
      await page.goto("/error?code=OAUTH_INVALID_REDIRECT_URI")
      await h1(page)
    },
  },
  {
    name: "18-not-found",
    go: async ({ page }) => {
      await page.goto("/nope")
      await h1(page)
    },
  },
  accountScreen("20-account", "/account"),
  accountScreen("21-account-profile", "/account/profile"),
  accountScreen("22-account-email", "/account/email"),
  accountScreen("23-account-sessions", "/account/sessions"),
  accountScreen("24-account-apps", "/account/apps"),
  accountScreen("25-account-security", "/account/security"),
  accountScreen("26-account-privacy", "/account/privacy"),
  accountScreen("27-account-delete", "/account/privacy/delete"),
  accountScreen("28-account-language", "/account/language"),
  {
    // Mert's account is saved in Turkish, so the account pages are Turkish whatever the browser
    // says: one capture covers it.
    name: "29-account-tr",
    locales: ["tr"],
    go: async ({ page }) => {
      await signIn(page, "mert@example.com")
      await h1(page, /Merhaba/)
    },
  },
]

test.describe.configure({ timeout: 90_000 })

for (const locale of ["en", "tr"] as const) {
  for (const scheme of ["light", "dark"] as const satisfies readonly Scheme[]) {
    test.describe(`${locale} ${scheme}`, () => {
      test.use({ uiLocale: locale, colorScheme: scheme })
      for (const s of screens) {
        if (s.locales && !s.locales.includes(locale)) continue
        test(s.name, async ({ app: page }) => {
          await s.go({ page, locale, t: tFor(locale) })
          await settle(page)
          await expect(page.locator("html")).toHaveAttribute("lang", locale)
          await expect(page).toHaveScreenshot(`${s.name}-${locale}-${scheme}.png`, { fullPage: true })
        })
      }
    })
  }
}
