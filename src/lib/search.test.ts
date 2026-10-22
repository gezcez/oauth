import { describe, expect, it } from "vitest"
import { authSearch, codeSearch } from "./search"

describe("search params", () => {
  it("keeps a valid request id and drops a malformed one", () => {
    expect(authSearch.parse({ req: "ar_01JABCDEFGHJKMNPQRSTVWXYZ0" }).req).toBe(
      "ar_01JABCDEFGHJKMNPQRSTVWXYZ0",
    )
    expect(authSearch.parse({ req: "ar__01JABCDEFGHJKMNPQRSTVWXYZ0" }).req).toBe(
      "ar__01JABCDEFGHJKMNPQRSTVWXYZ0",
    )
    expect(authSearch.parse({ req: "ar_<script>" }).req).toBeUndefined()
    expect(authSearch.parse({ req: 42 }).req).toBeUndefined()
  })
  it("drops unsafe return paths", () => {
    expect(authSearch.parse({ return: "/account/security" }).return).toBe("/account/security")
    expect(authSearch.parse({ return: "//evil.com" }).return).toBeUndefined()
    expect(authSearch.parse({ return: "https://evil.com" }).return).toBeUndefined()
    expect(authSearch.parse({ return: "javascript:alert(1)" }).return).toBeUndefined()
  })
  it("validates flow ids", () => {
    expect(codeSearch.parse({ flow: "fl_01JABCDEFGHJKMNPQRSTVWXYZ0" }).flow).toBeDefined()
    expect(codeSearch.parse({ flow: "../../x" }).flow).toBeUndefined()
  })
})
