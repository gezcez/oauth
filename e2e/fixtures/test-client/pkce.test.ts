import { describe, expect, it } from "vitest"
import { challengeS256, createState, createVerifier } from "./pkce"

describe("test client PKCE (oauth.md 9.8 vectors 1 to 3)", () => {
  it("matches RFC 7636 Appendix B", async () => {
    expect(await challengeS256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    )
  })
  it("creates 43 character verifiers that never repeat", () => {
    const a = createVerifier()
    const b = createVerifier()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(a).not.toBe(b)
  })
  it("creates 22 character states", () => {
    expect(createState()).toMatch(/^[A-Za-z0-9_-]{22}$/)
  })
})
