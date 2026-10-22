import type { Page } from "@playwright/test"
import { catalogs, interpolate, lookup } from "../../src/i18n/translate"
import type { Locale } from "../../src/i18n/types"
import { test as appTest } from "../fixtures/app"

/**
 * Deterministic page setup for the visual regression suite (see README "Visual regression").
 *
 * - Clock: `Date` is frozen at FROZEN_NOW (timers keep running), so relative times, the footer
 *   year, countdowns ("Resend in 0:30", "Try again in 1:15") and the mock seed's dates never move.
 * - Randomness: Math.random and crypto.getRandomValues are replaced by a seeded PRNG, so mock ids and
 *   the error page's support reference are the same on every run.
 * - Locale and time zone are fixed per test; the UI language comes from the stored preference.
 * - Motion: prefers-reduced-motion plus Playwright's `animations: "disabled"` at capture time.
 * - Fonts: every capture waits for `document.fonts.ready` and checks that Inter actually loaded.
 */
export const FROZEN_NOW = new Date("2026-03-14T09:30:00+03:00")
export const TIME_ZONE = "Europe/Istanbul"
export const RANDOM_SEED = 0x67c2c2

export type Scheme = "light" | "dark"

export function tFor(locale: Locale) {
  return (key: string, vars?: Record<string, string | number>): string => {
    const v = lookup(catalogs[locale], key) ?? lookup(catalogs.en, key)
    if (v === undefined) throw new Error(`visual: missing catalog key ${key}`)
    return interpolate(v, vars)
  }
}

function seedRandom(seed: number) {
  let s = seed >>> 0
  // mulberry32
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  Math.random = next
  const fill = <T extends ArrayBufferView | null>(arr: T): T => {
    if (arr) {
      const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength)
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(next() * 256)
    }
    return arr
  }
  Object.defineProperty(crypto, "getRandomValues", { value: fill, configurable: true })
}

export const test = appTest.extend<{ locale: string; uiLocale: Locale }>({
  uiLocale: ["en", { option: true }],
  locale: async ({ uiLocale }, use) => use(uiLocale === "tr" ? "tr-TR" : "en-GB"),
  timezoneId: TIME_ZONE,
  reducedMotion: "reduce",
  app: async ({ app, uiLocale }, use) => {
    await app.clock.setFixedTime(FROZEN_NOW)
    await app.addInitScript(seedRandom, RANDOM_SEED)
    await app.addInitScript((l) => {
      try {
        localStorage.setItem("gz.locale", l)
      } catch {
        // ignore
      }
    }, uiLocale)
    await use(app)
  },
})

/** Wait until nothing on the page is loading and every web font has been applied. */
export async function settle(page: Page) {
  await page.waitForLoadState("networkidle")
  await page.locator('[aria-busy="true"]').first().waitFor({ state: "detached", timeout: 15_000 })
  await page.evaluate(async () => {
    await document.fonts.ready
    const inter = [...document.fonts].filter((f) => f.family.replace(/["']/g, "") === "Inter Variable")
    if (!inter.some((f) => f.status === "loaded")) throw new Error("visual: Inter did not load")
  })
  await page.mouse.move(0, 0)
}

/**
 * Change a seeded account's saved language in the mock backend (persisted in sessionStorage). The
 * account pages follow the account's language, so this is how they are captured in both locales.
 * Takes effect on the next navigation.
 */
export async function setAccountLocale(page: Page, email: string, locale: Locale) {
  await page.evaluate(
    ([e, l]) => {
      const raw = sessionStorage.getItem("gz.mock.db")
      if (!raw) throw new Error("visual: mock db not initialised")
      const db = JSON.parse(raw) as { users: { email: string; locale: string }[] }
      const u = db.users.find((x) => x.email === e)
      if (!u) throw new Error(`visual: no mock user ${e}`)
      u.locale = l
      sessionStorage.setItem("gz.mock.db", JSON.stringify(db))
    },
    [email, locale] as const,
  )
}
