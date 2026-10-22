import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const headers = fs.readFileSync(path.resolve(__dirname, "../public/_headers"), "utf8")
const csp = /Content-Security-Policy: (.+)/.exec(headers)?.[1] ?? ""
const directives = Object.fromEntries(
  csp.split(";").map((d) => {
    const [name, ...values] = d.trim().split(/\s+/)
    return [name, values]
  }),
)

describe("public/_headers", () => {
  it("forbids framing in both CSP and X-Frame-Options", () => {
    expect(directives["frame-ancestors"]).toEqual(["'none'"])
    expect(headers).toMatch(/X-Frame-Options: DENY/)
  })
  it("allows no inline or eval scripts and only Turnstile as a third party", () => {
    expect(directives["script-src"]).toEqual(["'self'", "https://challenges.cloudflare.com"])
    expect(csp).not.toMatch(/unsafe-eval|'unsafe-inline' https|script-src[^;]*unsafe-inline/)
    expect(directives["frame-src"]).toEqual(["https://challenges.cloudflare.com"])
  })
  it("locks down defaults, base and objects", () => {
    expect(directives["default-src"]).toEqual(["'none'"])
    expect(directives["base-uri"]).toEqual(["'none'"])
    expect(directives["object-src"]).toEqual(["'none'"])
    expect(directives["form-action"]).toEqual(["'self'"])
  })
  it("talks only to the gezcez API", () => {
    expect(directives["connect-src"]).toEqual(["'self'", "https://api.gezcez.com", "https://api-staging.gezcez.com"])
  })
  it("sets the transport and isolation headers", () => {
    for (const h of [
      "Strict-Transport-Security: max-age=63072000; includeSubDomains; preload",
      "Referrer-Policy: no-referrer",
      "Cross-Origin-Opener-Policy: same-origin",
      "X-Content-Type-Options: nosniff",
    ]) {
      expect(headers).toContain(h)
    }
  })
  it("never caches index.html and caches hashed assets forever", () => {
    expect(headers).toMatch(/\/\*\n(?:.*\n)*?\s+Cache-Control: no-store/)
    expect(headers).toMatch(/\/assets\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/)
  })
})
