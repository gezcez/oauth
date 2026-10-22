import { describe, expect, it } from "vitest"
import { targetForNext } from "./dispatch"

const req = "ar_01JABCDEFGHJKMNPQRSTVWXYZ0"

describe("targetForNext", () => {
  it("follows redirect_to only when the API gave one", () => {
    expect(targetForNext("redirect", req, "https://dash.gezcez.com/auth/callback?code=x&state=y")).toEqual({
      kind: "external",
      url: "https://dash.gezcez.com/auth/callback?code=x&state=y",
    })
    expect(targetForNext("redirect", req, null)).toEqual({ kind: "error", code: "OAUTH_REQUEST_NOT_FOUND" })
  })
  it.each([
    ["login", "/signin"],
    ["reauth", "/reauth"],
    ["choose_account", "/choose"],
    ["consent", "/consent"],
  ] as const)("%s goes to %s with req", (next, to) => {
    expect(targetForNext(next, req)).toEqual({ kind: "route", to, search: { req } })
  })
  it("handles the request id being null when the backend rejected the request up front", () => {
    expect(targetForNext("redirect", null, "http://localhost:4710/callback?error=invalid_scope")).toEqual({
      kind: "external",
      url: "http://localhost:4710/callback?error=invalid_scope",
    })
    expect(targetForNext("login", null)).toEqual({ kind: "error", code: "OAUTH_REQUEST_NOT_FOUND" })
  })
})
