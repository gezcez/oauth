import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { catalogs } from "./translate"
import { rich } from "./rich"

describe("rich", () => {
  it("renders tag slots with no stray spaces", () => {
    const { container } = render(
      <p>
        {rich("I accept the <a>Terms</a> and <b>Privacy (KVKK)</b>.", {
          a: (c) => <em>{c}</em>,
          b: (c) => <strong>{c}</strong>,
        })}
      </p>,
    )
    expect(container.innerHTML).toBe(
      "<p>I accept the <em>Terms</em> and <strong>Privacy (KVKK)</strong>.</p>",
    )
  })

  it("renders unknown tags as text", () => {
    const { container } = render(<p>{rich("<x>hi</x>!", {})}</p>)
    expect(container.textContent).toBe("hi!")
  })

  it("terms sentence has both slots in every locale", () => {
    for (const c of Object.values(catalogs)) {
      expect(c.auth.profile.terms).toMatch(/<terms>.+<\/terms>/)
      expect(c.auth.profile.terms).toMatch(/<privacy>.+<\/privacy>/)
      expect(c.auth.profile.terms).not.toMatch(/\s[.,]/)
    }
  })
})
