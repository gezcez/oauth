import { describe, expect, it } from "vitest"
import { createI18n } from "@/i18n"
import { errorBehaviour, GezcezError, isOAuthPageError, toGezcezError } from "./errors"
import { errorMessage } from "./use-api-error"

describe("errors", () => {
  it("never redirects back for the four non-redirectable OAuth errors", () => {
    for (const c of [
      "OAUTH_INVALID_CLIENT",
      "OAUTH_INVALID_REDIRECT_URI",
      "OAUTH_REQUEST_EXPIRED",
      "OAUTH_REQUEST_NOT_FOUND",
    ]) {
      expect(isOAuthPageError(c)).toBe(true)
      expect(errorBehaviour[c as keyof typeof errorBehaviour]).toBe("page")
    }
    expect(isOAuthPageError("RATE_LIMITED")).toBe(false)
  })

  it("routes session and step-up errors", () => {
    expect(errorBehaviour.AUTH_SESSION_REQUIRED).toBe("signin")
    expect(errorBehaviour.AUTH_STEP_UP_REQUIRED).toBe("reauth")
    expect(errorBehaviour.CSRF_INVALID).toBe("silent")
  })

  it("normalises unknown throwables", () => {
    expect(toGezcezError(new TypeError("Failed to fetch")).code).toBe("NETWORK")
    expect(toGezcezError("boom").code).toBe("UNKNOWN")
  })

  it("formats messages with retry time and attempts left", () => {
    const en = createI18n("en")
    const tr = createI18n("tr")
    expect(errorMessage(en, new GezcezError("RATE_LIMITED", { details: { retry_after: 75 } }))).toBe(
      "Too many tries. Try again in 1:15.",
    )
    expect(errorMessage(en, new GezcezError("RATE_LIMITED", { details: { retry_after: 600 } }))).toBe(
      "Too many tries. Try again in 10 minutes.",
    )
    expect(errorMessage(en, new GezcezError("RATE_LIMITED"))).toBe(
      "Too many tries. Try again in a few minutes.",
    )
    expect(errorMessage(en, new GezcezError("AUTH_CODE_INVALID", { details: { attempts_left: 3 } }))).toBe(
      "That code is not right. You have 3 tries left.",
    )
    expect(errorMessage(tr, new GezcezError("AUTH_CODE_INVALID", { details: { attempts_left: 3 } }))).toBe(
      "Bu kod doğru değil. 3 deneme hakkınız kaldı.",
    )
  })
})
