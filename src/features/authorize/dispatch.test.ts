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
})
