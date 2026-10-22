import { afterEach, describe, expect, it, vi } from "vitest"
import { detectLocale, fromUiLocales, normaliseLocale, storeLocale } from "./locale"

describe("locale detection", () => {
  afterEach(() => vi.unstubAllGlobals())
  it("normalises tags", () => {
    expect(normaliseLocale("tr-TR")).toBe("tr")
    expect(normaliseLocale("en_GB")).toBe("en")
    expect(normaliseLocale("de")).toBeNull()
  })
  it("picks the first supported ui_locales entry", () => {
    expect(fromUiLocales("de fr tr en")).toBe("tr")
    expect(fromUiLocales("de")).toBeNull()
  })
  it("follows ui_locales > account > stored > navigator > en", () => {
    vi.stubGlobal("navigator", { languages: ["de-DE"], language: "de-DE" })
    expect(detectLocale()).toBe("en")
    vi.stubGlobal("navigator", { languages: ["tr-TR"], language: "tr-TR" })
    expect(detectLocale()).toBe("tr")
    storeLocale("en")
    expect(detectLocale()).toBe("en")
    expect(detectLocale({ account: "tr" })).toBe("tr")
    expect(detectLocale({ uiLocales: "en", account: "tr" })).toBe("en")
  })
})
