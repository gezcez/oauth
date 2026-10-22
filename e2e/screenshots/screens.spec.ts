import type { Page } from "@playwright/test"
import { authorizePath, enterCode, enterEmail, expect, signIn, test } from "../fixtures/app"

/**
 * Captures every main screen in light and dark, desktop and mobile, against the mock build.
 * Run with `bun run screenshots` (SCREENSHOTS=1, project `screenshots`). Output: SCREENSHOT_DIR,
 * default /mnt/project-files/revamp/screens/oauth.
 */
const OUT = process.env.SCREENSHOT_DIR ?? "/mnt/project-files/revamp/screens/oauth"

const variants = [
  { name: "desktop", viewport: { width: 1280, height: 860 }, isMobile: false },
  { name: "mobile", viewport: { width: 390, height: 844 }, isMobile: true },
] as const

type Shot = { name: string; go: (page: Page) => Promise<void> }

const h1 = (page: Page) => expect(page.getByRole("heading", { level: 1 })).toBeVisible()

const screens: Shot[] = [
  {
    name: "01-signin",
    go: async (p) => {
      await p.goto("/signin")
      await h1(p)
    },
  },
  {
    name: "02-signin-client",
    go: async (p) => {
      await p.goto(authorizePath())
      await expect(p.getByText("Sign in to Dashboard")).toBeVisible()
    },
  },
  {
    name: "03-code",
    go: async (p) => {
      await p.goto("/signin")
      await enterEmail(p, "ada@example.com")
      await expect(p.getByLabel("Code")).toBeVisible()
    },
  },
  {
    name: "04-code-error",
    go: async (p) => {
      await p.goto("/signin")
      await enterEmail(p, "ada@example.com")
      await enterCode(p, "999999")
      await expect(p.getByText(/That code is not right/)).toBeVisible()
    },
  },
  {
    name: "05-password",
    go: async (p) => {
      await p.goto("/signin/password")
      await h1(p)
    },
  },
  {
    name: "06-signup",
    go: async (p) => {
      await p.goto("/signup")
      await h1(p)
    },
  },
  {
    name: "07-signup-profile",
    go: async (p) => {
      await p.goto("/signup")
      await enterEmail(p, "grace.hopper@example.com")
      await enterCode(p, "123456")
      await expect(p.getByRole("heading", { name: "Almost done" })).toBeVisible()
    },
  },
  {
    name: "08-rate-limited",
    go: async (p) => {
      await p.goto("/signin")
      await enterEmail(p, "ratelimit@example.com")
      await expect(p.getByRole("button", { name: /Try again in/ })).toBeVisible()
    },
  },
  {
    name: "09-reset",
    go: async (p) => {
      await p.goto("/reset")
      await h1(p)
    },
  },
  {
    name: "10-chooser",
    go: async (p) => {
      await signIn(p, "mert@example.com")
      await signIn(p, "ada@example.com")
      await p.goto(authorizePath({ prompt: "select_account" }))
      await expect(p.getByRole("heading", { name: "Choose an account" })).toBeVisible()
    },
  },
  {
    name: "11-consent",
    go: async (p) => {
      await signIn(p)
      await p.goto(
        authorizePath({
          client_id: "e2e_third_party",
          redirect_uri: "https://stats.example/callback",
          scope: "openid profile transit",
        }),
      )
      await expect(p.getByRole("button", { name: "Allow" })).toBeVisible()
    },
  },
  {
    name: "12-reauth",
    go: async (p) => {
      await signIn(p)
      await p.goto("/reauth?return=%2Faccount%2Fsecurity")
      await expect(p.getByRole("heading", { name: "Confirm it's you" })).toBeVisible()
    },
  },
  {
    name: "13-logout-confirm",
    go: async (p) => {
      await signIn(p)
      await p.goto("/logout")
      await h1(p)
    },
  },
  {
    name: "14-signed-out",
    go: async (p) => {
      await p.goto("/signed-out")
      await h1(p)
    },
  },
  {
    name: "15-banned",
    go: async (p) => {
      await p.goto("/signin")
      await enterEmail(p, "banned@example.com")
      await enterCode(p, "123456")
      await expect(p.getByRole("heading", { name: "This account can't sign in" })).toBeVisible()
    },
  },
  {
    name: "16-pending-deletion",
    go: async (p) => {
      await p.goto("/signin")
      await enterEmail(p, "deleting@example.com")
      await enterCode(p, "123456")
      await expect(p.getByRole("heading", { name: "Your account is scheduled for deletion" })).toBeVisible()
    },
  },
  {
    name: "17-error",
    go: async (p) => {
      await p.goto("/error?code=OAUTH_INVALID_REDIRECT_URI")
      await h1(p)
    },
  },
  {
    name: "18-not-found",
    go: async (p) => {
      await p.goto("/nope")
      await h1(p)
    },
  },
  ...(
    [
      ["20-account", "/account"],
      ["21-account-profile", "/account/profile"],
      ["22-account-email", "/account/email"],
      ["23-account-sessions", "/account/sessions"],
      ["24-account-apps", "/account/apps"],
      ["25-account-security", "/account/security"],
      ["26-account-privacy", "/account/privacy"],
      ["27-account-delete", "/account/privacy/delete"],
      ["28-account-language", "/account/language"],
    ] as const
  ).map(([name, path]): Shot => ({
    name,
    go: async (p) => {
      await signIn(p)
      await p.goto(path)
      await expect(p.getByRole("status", { name: "Loading" })).toHaveCount(0, { timeout: 15_000 })
      await h1(p)
    },
  })),
  {
    name: "29-account-tr",
    go: async (p) => {
      await signIn(p, "mert@example.com")
      // Wait for real content, not just the layout: the overview heading and its cards.
      await expect(p.getByRole("heading", { level: 1, name: /Merhaba/ })).toBeVisible({ timeout: 15_000 })
      await expect(p.getByRole("status", { name: "Yükleniyor" })).toHaveCount(0)
    },
  },
]

test.describe.configure({ timeout: 60_000 })

for (const v of variants) {
  for (const scheme of ["light", "dark"] as const) {
    test.describe(`${v.name} ${scheme}`, () => {
      test.use({ viewport: v.viewport, isMobile: v.isMobile, hasTouch: v.isMobile, colorScheme: scheme })
      for (const s of screens) {
        test(s.name, async ({ app: page }) => {
          await s.go(page)
          await page.evaluate(() => document.fonts.ready)
          // Let toasts and transitions settle so captures are stable.
          await page.waitForTimeout(400)
          await page.mouse.move(0, 0)
          await page.screenshot({
            path: `${OUT}/${s.name}-${v.name}-${scheme}.png`,
            fullPage: true,
            animations: "disabled",
            caret: "hide",
          })
        })
      }
    })
  }
}
