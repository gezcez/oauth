import { describe, expect, it } from "vitest"
import { initialsOf, maskEmail, nameFromEmail } from "./mask"

describe("mask", () => {
  it("masks emails", () => {
    expect(maskEmail("ada@example.com")).toBe("a***@example.com")
    expect(maskEmail("x@y.z")).toBe("x***@y.z")
    expect(maskEmail("not-an-email")).toBe("not-an-email")
  })
  it("suggests names", () => {
    expect(nameFromEmail("ada.lovelace@example.com")).toBe("Ada Lovelace")
    expect(nameFromEmail("ilker_99@example.com")).toBe("İlker")
    expect(nameFromEmail("@x.com")).toBe("")
  })
  it("builds initials", () => {
    expect(initialsOf("Ada Lovelace")).toBe("AL")
    expect(initialsOf("ismail")).toBe("İ")
    expect(initialsOf("  ")).toBe("?")
  })
})
