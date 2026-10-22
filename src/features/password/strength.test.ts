import { describe, expect, it } from "vitest"
import { passwordStrength } from "./strength"

describe("passwordStrength", () => {
  it("rates by length first", () => {
    expect(passwordStrength("short")).toBe(0)
    expect(passwordStrength("abcdefghij")).toBe(0)
    expect(passwordStrength("tramvay kadikoy")).toBe(1)
    expect(passwordStrength("Tramvay Kadıköy'den 7 geçer")).toBe(2)
  })
  it("penalises obvious patterns", () => {
    expect(passwordStrength("aaaaaaaaaaaaaaaaaaaa")).toBe(0)
    expect(passwordStrength("password12345678")).toBe(0)
  })
})
