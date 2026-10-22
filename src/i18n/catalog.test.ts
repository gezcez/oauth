import { describe, expect, it } from "vitest"
import type { components } from "@/api/schema.gen"
import { catalogs, interpolate, lookup, translate, translatePlural } from "./translate"

type ErrorCode = components["schemas"]["ErrorCode"]

function leaves(obj: unknown, prefix = ""): string[] {
  if (typeof obj === "string") return [prefix]
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leaves(v, prefix ? `${prefix}.${k}` : k),
  )
}

// Kept in sync with the generated ErrorCode union by the `satisfies` below.
const ALL_CODES = [
  "VALIDATION_FAILED",
  "AUTH_REQUIRED",
  "AUTH_SESSION_REQUIRED",
  "AUTH_TOKEN_INVALID",
  "AUTH_TOKEN_EXPIRED",
  "AUTH_SESSION_REVOKED",
  "AUTH_CODE_INVALID",
  "AUTH_CODE_EXPIRED",
  "AUTH_CODE_ATTEMPTS",
  "AUTH_PASSWORD_INVALID",
  "AUTH_PASSWORD_WEAK",
  "AUTH_PASSWORD_BREACHED",
  "AUTH_TURNSTILE_FAILED",
  "AUTH_STEP_UP_REQUIRED",
  "CSRF_INVALID",
  "OAUTH_INVALID_CLIENT",
  "OAUTH_INVALID_REDIRECT_URI",
  "OAUTH_REQUEST_EXPIRED",
  "OAUTH_REQUEST_NOT_FOUND",
  "SCOPE_MISSING",
  "PERMISSION_MISSING",
  "ROLE_LEVEL_TOO_LOW",
  "ROLE_IMMUTABLE",
  "USER_BANNED",
  "USER_PENDING_DELETION",
  "USER_DELETED",
  "EMAIL_TAKEN",
  "USERNAME_TAKEN",
  "NOT_FOUND",
  "CONFLICT",
  "VERSION_CONFLICT",
  "RATE_LIMITED",
  "PROVIDER_DISABLED",
  "PROVIDER_UNAVAILABLE",
  "CAPABILITY_UNSUPPORTED",
  "CARD_NOT_FOUND",
  "ANALYTICS_TIMEOUT",
  "INTERNAL",
] as const satisfies readonly ErrorCode[]
type Missing = Exclude<ErrorCode, (typeof ALL_CODES)[number]>
const exhaustive: [Missing] extends [never] ? true : Missing = true

describe("i18n catalogs", () => {
  it("tr and en have exactly the same keys", () => {
    expect(leaves(catalogs.tr).sort()).toEqual(leaves(catalogs.en).sort())
  })

  it("has no empty strings except intentional Turkish word-order gaps", () => {
    for (const [locale, cat] of Object.entries(catalogs)) {
      for (const key of leaves(cat)) {
        const value = lookup(cat, key)
        if (locale === "tr" && key === "auth.profile.termsPrefix") continue
        expect(value, `${locale}:${key}`).toBeTruthy()
      }
    }
  })

  it("uses the same placeholders in both languages", () => {
    for (const key of leaves(catalogs.en)) {
      const vars = (s: string | undefined) => [...(s ?? "").matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
      expect(vars(lookup(catalogs.tr, key)), key).toEqual(vars(lookup(catalogs.en, key)))
    }
  })

  it("translates every backend error code in both languages", () => {
    expect(exhaustive).toBe(true)
    for (const code of ALL_CODES) {
      expect(lookup(catalogs.en.errors, code)).toBeTruthy()
      expect(lookup(catalogs.tr.errors, code)).toBeTruthy()
    }
  })

  it("interpolates and pluralises", () => {
    expect(interpolate("Hi {name}", { name: "Ada" })).toBe("Hi Ada")
    expect(translate("en", "auth.code.lead", { length: 6, email: "a***@x.com" })).toBe(
      "We sent a 6-digit code to a***@x.com.",
    )
    expect(translatePlural("en", "errors.attemptsLeft", 1)).toBe("You have 1 try left.")
    expect(translatePlural("en", "errors.attemptsLeft", 3)).toBe("You have 3 tries left.")
    expect(translatePlural("tr", "errors.attemptsLeft", 3)).toBe("3 deneme hakkınız kaldı.")
  })

  it("looks up keys that contain dots", () => {
    expect(translate("en", "account.security.eventTypes.auth.login")).toBe("Signed in")
  })

  it("uses the formal 'siz' register in Turkish (no casual imperatives on key screens)", () => {
    const casual = [/\bgir\b/i, /\bseç\b(?!in)/i, /\bdene\b/i]
    for (const key of ["auth.signin.lead", "auth.code.title", "errors.AUTH_CODE_INVALID"] as const) {
      const v = translate("tr", key)
      for (const re of casual) expect(v).not.toMatch(re)
    }
  })
})
