import { describe, expect, it } from "vitest"
import { safeInternalPath } from "./navigation"

const origin = "https://oauth.gezcez.com"

describe("safeInternalPath", () => {
  it.each([
    ["/", "/"],
    ["/a?b=c#d", "/a?b=c#d"],
    ["/account/security", "/account/security"],
    ["/account/privacy/delete?x=1", "/account/privacy/delete?x=1"],
  ])("keeps %s", (input, expected) => {
    expect(safeInternalPath(input, origin)).toBe(expected)
  })

  it.each([
    "//evil.com",
    "/\\evil.com",
    "https://evil",
    "http://evil.com/x",
    "javascript:alert(1)",
    "%2F%2Fevil.com",
    "/%5Cevil.com",
    "/%2F%2Fevil.com",
    "/%2fevil.com",
    "",
    "evil.com",
    "\\\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "%",
    "/%E0%A4%A",
    " /x",
  ])("rejects %j", (input) => {
    expect(safeInternalPath(input, origin)).toBe("/")
  })

  it("rejects non-strings", () => {
    expect(safeInternalPath(undefined, origin)).toBe("/")
    expect(safeInternalPath(null, origin)).toBe("/")
    expect(safeInternalPath(42, origin)).toBe("/")
    expect(safeInternalPath(["/a"], origin)).toBe("/")
  })

  it("rejects very long values", () => {
    expect(safeInternalPath("/" + "a".repeat(5000), origin)).toBe("/")
  })
})
