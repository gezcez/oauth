import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getDb, signInAs } from "@/mocks/db"
import { renderApp } from "@/test/render-app"
import type * as Navigation from "@/lib/navigation"

const followRedirect = vi.fn()
vi.mock("@/lib/navigation", async (orig) => ({
  ...(await orig<typeof Navigation>()),
  followRedirect: (url: string) => followRedirect(url),
  replaceUrl: vi.fn(),
}))

const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
function authorizeUrl(extra: Record<string, string> = {}) {
  const p = new URLSearchParams({
    client_id: "dashboard",
    redirect_uri: "https://dash.gezcez.com/auth/callback",
    response_type: "code",
    scope: "openid profile email offline_access",
    state: "st-123",
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
    ...extra,
  })
  return `/authorize?${p}`
}

/** /authorize reads the raw query from window.location; mirror the memory history there. */
function setWindowSearch(path: string) {
  window.history.replaceState(null, "", path)
}

async function enterEmail(user: ReturnType<typeof userEvent.setup>, email: string) {
  await user.type(await screen.findByLabelText("Email"), email)
  await user.click(screen.getByRole("button", { name: "Continue" }))
}

async function enterCode(user: ReturnType<typeof userEvent.setup>, code: string) {
  const input = await screen.findByLabelText("Code", {}, { timeout: 3000 })
  await user.clear(input)
  await user.type(input, code)
}

beforeEach(() => {
  followRedirect.mockReset()
})

describe("sign-in with an email code", () => {
  it("signs up a new address end to end and lands on the account with a welcome", async () => {
    const user = userEvent.setup()
    const { router } = await renderApp("/signin")
    await enterEmail(user, "grace.hopper@example.com")
    await screen.findByRole("heading", { name: "Check your email" })
    expect(screen.getByText(/g\*\*\*@example\.com/)).toBeInTheDocument()
    await enterCode(user, "123456")
    await screen.findByRole("heading", { name: "Almost done" })
    expect(screen.getByLabelText("Display name")).toHaveValue("Grace Hopper")
    await user.click(screen.getByRole("button", { name: "Create account" }))
    expect(await screen.findByText("Accept the terms to create your account.")).toBeInTheDocument()
    await user.click(screen.getByRole("checkbox", { name: /Terms of Use/ }))
    await user.click(screen.getByRole("button", { name: "Create account" }))
    await waitFor(() => expect(router.state.location.pathname).toBe("/account"), { timeout: 4000 })
    expect(
      await screen.findByText("Welcome to gezcez. Your account is ready.", undefined, { timeout: 4000 }),
    ).toBeInTheDocument()
  })

  it("validates the email before calling the API", async () => {
    const user = userEvent.setup()
    await renderApp("/signin")
    await enterEmail(user, "not-an-email")
    expect(await screen.findByText("Enter an email address like name@example.com.")).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
      "Enter an email address like name@example.com.",
    )
  })

  it("wrong code clears the input and shows tries left; expired code offers a new one", async () => {
    const user = userEvent.setup()
    await renderApp("/signin")
    await enterEmail(user, "ada@example.com")
    await enterCode(user, "999999")
    expect(await screen.findByText("That code is not right. You have 4 tries left.")).toBeInTheDocument()
    expect(screen.getByLabelText("Code")).toHaveValue("")
    await enterCode(user, "000000")
    expect(await screen.findByText("This code has expired. We can send you a new one.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Send a new code|Try again in/ })).toBeInTheDocument()
  })

  it("too many tries offers a new code", async () => {
    const user = userEvent.setup()
    await renderApp("/signin")
    await enterEmail(user, "ada@example.com")
    await enterCode(user, "111111")
    expect(await screen.findByText(/Too many wrong tries for this code/)).toBeInTheDocument()
  })

  it("shows a live countdown on RATE_LIMITED and keeps the email", async () => {
    const user = userEvent.setup()
    await renderApp("/signin")
    await enterEmail(user, "ratelimit@example.com")
    const btn = await screen.findByRole("button", { name: /Try again in 1:1\d/ })
    expect(btn).toBeDisabled()
    expect(screen.getByText(/Too many tries\. Try again in 1:1\d\./)).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toHaveValue("ratelimit@example.com")
  })

  it("shows the Turnstile failure inline", async () => {
    const user = userEvent.setup()
    await renderApp("/signin")
    await enterEmail(user, "turnstile@example.com")
    expect(await screen.findByText("We couldn't check your browser. Try again.")).toBeInTheDocument()
  })

  it("banned accounts see the ban page only after proving the code", async () => {
    const user = userEvent.setup()
    const { router } = await renderApp("/signin")
    await enterEmail(user, "banned@example.com")
    await screen.findByRole("heading", { name: "Check your email" })
    await enterCode(user, "123456")
    await waitFor(() => expect(router.state.location.pathname).toBe("/banned"))
    expect(await screen.findByText("Repeated abuse of the report feature.")).toBeInTheDocument()
  })

  it("pending deletion can be cancelled", async () => {
    const user = userEvent.setup()
    const { router } = await renderApp("/signin")
    await enterEmail(user, "deleting@example.com")
    await enterCode(user, "123456")
    await waitFor(() => expect(router.state.location.pathname).toBe("/pending-deletion"))
    await user.click(await screen.findByRole("button", { name: "Keep my account" }))
    await waitFor(() => expect(router.state.location.pathname).toBe("/account"))
    expect(getDb().users.find((u) => u.email === "deleting@example.com")!.status).toBe("active")
  })

  it("never follows an unsafe return path after sign-in", async () => {
    const user = userEvent.setup()
    const { router } = await renderApp("/signin?return=%2F%2Fevil.com")
    expect(router.state.location.search).toEqual({})
    await enterEmail(user, "ada@example.com")
    await enterCode(user, "123456")
    await waitFor(() => expect(router.state.location.pathname).toBe("/account"))
  })

  it("returns to a safe internal path after sign-in", async () => {
    const user = userEvent.setup()
    const { router } = await renderApp("/signin?return=%2Faccount%2Fsecurity")
    await enterEmail(user, "ada@example.com")
    await enterCode(user, "123456")
    await waitFor(() => expect(router.state.location.pathname).toBe("/account/security"))
  })
})

describe("password sign-in", () => {
  it("gives the same generic error for a wrong password and an unknown email", async () => {
    const user = userEvent.setup()
    await renderApp("/signin/password")
    await user.type(screen.getByLabelText("Email"), "ada@example.com")
    await user.type(screen.getByLabelText("Password"), "wrong password")
    await user.click(screen.getByRole("button", { name: "Sign in" }))
    const alertText = async () => {
      await screen.findByText(/Email or password is not right/)
      return (await screen.findAllByRole("alert")).map((a) => a.textContent).find(Boolean)
    }
    const first = await alertText()
    await user.clear(screen.getByLabelText("Email"))
    await user.type(screen.getByLabelText("Email"), "nobody@example.com")
    await user.type(screen.getByLabelText("Password"), "whatever123")
    await user.click(screen.getByRole("button", { name: "Sign in" }))
    await waitFor(() => expect(screen.getByLabelText("Password")).toHaveValue(""))
    expect(await alertText()).toBe(first)
    expect(first).toContain("Email or password is not right.")
  })

  it("signs in with the right password", async () => {
    const user = userEvent.setup()
    const { router } = await renderApp("/signin/password")
    await user.type(screen.getByLabelText("Email"), "ada@example.com")
    await user.type(screen.getByLabelText("Password"), "correct horse battery")
    await user.click(screen.getByRole("button", { name: "Sign in" }))
    await waitFor(() => expect(router.state.location.pathname).toBe("/account"))
  })
})

describe("/authorize", () => {
  it("posts the raw query and routes to /signin?req when there is no session", async () => {
    const url = authorizeUrl()
    setWindowSearch(url)
    const { router } = await renderApp(url)
    await waitFor(() => expect(router.state.location.pathname).toBe("/signin"))
    expect(router.state.location.search.req).toMatch(/^ar_/)
    expect(await screen.findByText("Sign in to Dashboard")).toBeInTheDocument()
  })

  it("fast path: follows the API's redirect_to without rendering a form", async () => {
    signInAs("ada@example.com")
    const url = authorizeUrl()
    setWindowSearch(url)
    await renderApp(url)
    await waitFor(() => expect(followRedirect).toHaveBeenCalledTimes(1))
    expect(followRedirect.mock.calls[0]![0]).toMatch(
      /^https:\/\/dash\.gezcez\.com\/auth\/callback\?code=.+&state=st-123$/,
    )
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument()
  })

  it("full round trip: sign in with a code, continue, redirect back to the client", async () => {
    const user = userEvent.setup()
    const url = authorizeUrl()
    setWindowSearch(url)
    await renderApp(url)
    await enterEmail(user, "ada@example.com")
    await enterCode(user, "123456")
    await waitFor(() => expect(followRedirect).toHaveBeenCalledTimes(1))
    expect(followRedirect.mock.calls[0]![0]).toContain("state=st-123")
  })

  it.each([
    [{ client_id: "nope" }, "We don't know this app"],
    [{ redirect_uri: "https://evil.example/cb" }, "This sign-in link is broken"],
  ])("shows the error page and never redirects for %j", async (extra, heading) => {
    const url = authorizeUrl(extra)
    setWindowSearch(url)
    const { router } = await renderApp(url)
    await waitFor(() => expect(router.state.location.pathname).toBe("/error"))
    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument()
    expect(followRedirect).not.toHaveBeenCalled()
    expect(document.body.textContent).not.toContain("evil.example")
  })

  it("redirects protocol errors (missing PKCE) back to the client", async () => {
    const url = authorizeUrl({ code_challenge_method: "plain" })
    setWindowSearch(url)
    await renderApp(url)
    await waitFor(() => expect(followRedirect).toHaveBeenCalled())
    expect(followRedirect.mock.calls[0]![0]).toContain("error=invalid_request")
  })

  it("expired or unknown request ids show the expiry page", async () => {
    const { router } = await renderApp("/signin?req=ar_01JZZZZZZZZZZZZZZZZZZZZZZZ")
    await waitFor(() => expect(router.state.location.pathname).toBe("/error"))
    expect(await screen.findByRole("heading", { name: "This sign-in took too long" })).toBeInTheDocument()
  })

  it("consent: deny returns access_denied, allow returns a code", async () => {
    signInAs("mert@example.com")
    const user = userEvent.setup()
    const url = authorizeUrl({
      client_id: "e2e_third_party",
      redirect_uri: "https://stats.example/callback",
      scope: "openid profile transit",
    })
    setWindowSearch(url)
    const { router } = await renderApp(url)
    await waitFor(() => expect(router.state.location.pathname).toBe("/consent"))
    expect(
      await screen.findByRole("heading", { name: "Transit Stats wants to access your gezcez account" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Sync your saved stops, routes and settings")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    await waitFor(() =>
      expect(followRedirect).toHaveBeenCalledWith(expect.stringContaining("error=access_denied")),
    )
    followRedirect.mockReset()
    await user.click(screen.getByRole("button", { name: "Allow" }))
    await waitFor(() => expect(followRedirect).toHaveBeenCalledWith(expect.stringMatching(/\?code=/)))
  })

  it("account chooser with prompt=select_account", async () => {
    signInAs("mert@example.com")
    signInAs("ada@example.com")
    const user = userEvent.setup()
    const url = authorizeUrl({ prompt: "select_account" })
    setWindowSearch(url)
    const { router } = await renderApp(url)
    await waitFor(() => expect(router.state.location.pathname).toBe("/choose"))
    await user.click(await screen.findByRole("button", { name: /Mert Yılmaz/ }))
    await waitFor(() => expect(followRedirect).toHaveBeenCalledWith(expect.stringMatching(/\?code=/)))
    const db = getDb()
    expect(
      db.users.find((u) => u.id === db.sessions.find((s) => s.id === db.active_session)!.user_id)!.email,
    ).toBe("mert@example.com")
  })

  it("step-up with max_age: re-auth with a code, then redirect", async () => {
    signInAs("ada@example.com", { authAgoMs: 3600_000 })
    const user = userEvent.setup()
    const url = authorizeUrl({ max_age: "600" })
    setWindowSearch(url)
    const { router } = await renderApp(url)
    await waitFor(() => expect(router.state.location.pathname).toBe("/reauth"))
    expect(
      await screen.findByText("Dashboard needs you to sign in again before this action."),
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Send a code to a\*\*\*@example.com/ }))
    await enterCode(user, "123456")
    await waitFor(() => expect(followRedirect).toHaveBeenCalledWith(expect.stringMatching(/\?code=/)))
  })
})

describe("logout", () => {
  it("registered post-logout URI: ends the session and follows redirect_to", async () => {
    signInAs("ada@example.com")
    await renderApp(
      "/logout?client_id=dashboard&post_logout_redirect_uri=https%3A%2F%2Fdash.gezcez.com%2Fauth%2Flogged-out&state=s1",
    )
    await waitFor(() =>
      expect(followRedirect).toHaveBeenCalledWith("https://dash.gezcez.com/auth/logged-out?state=s1"),
    )
    expect(getDb().active_session).toBeNull()
  })

  it("unregistered URI: ends nothing and asks first", async () => {
    signInAs("ada@example.com")
    const user = userEvent.setup()
    const { router } = await renderApp(
      "/logout?client_id=dashboard&post_logout_redirect_uri=https%3A%2F%2Fevil.example%2F",
    )
    expect(
      await screen.findByRole("heading", { name: "Sign out of gezcez on this browser?" }),
    ).toBeInTheDocument()
    expect(getDb().active_session).not.toBeNull()
    expect(followRedirect).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Sign out" }))
    await waitFor(() => expect(router.state.location.pathname).toBe("/signed-out"))
    expect(getDb().active_session).toBeNull()
  })
})

describe("account step-up", () => {
  it("a stale session goes through /reauth before changing the password, then comes back", async () => {
    signInAs("ada@example.com", { authAgoMs: 3600_000 })
    const user = userEvent.setup()
    const { router } = await renderApp("/account/security")
    await user.click(await screen.findByRole("button", { name: "Change password" }))
    await waitFor(() => expect(router.state.location.pathname).toBe("/reauth"))
    await user.click(await screen.findByRole("button", { name: "Use password" }))
    await user.type(await screen.findByLabelText("Password"), "correct horse battery")
    await user.click(screen.getByRole("button", { name: "Confirm" }))
    await waitFor(() => expect(router.state.location.pathname).toBe("/account/security"))
    await user.click(await screen.findByRole("button", { name: "Change password" }))
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    await user.type(screen.getByLabelText("New password"), "short")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByText("Use at least 10 characters.")).toBeInTheDocument()
    await user.clear(screen.getByLabelText("New password"))
    await user.type(screen.getByLabelText("New password"), "breached-password-123")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByText(/appeared in a data leak/)).toBeInTheDocument()
    await user.clear(screen.getByLabelText("New password"))
    await user.type(screen.getByLabelText("New password"), "a much longer pass phrase")
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Save" }))
    })
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("sign out of all other devices reports the count", async () => {
    signInAs("ada@example.com")
    const user = userEvent.setup()
    await renderApp("/account/sessions")
    expect(await screen.findByText("This device")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Sign out of all other devices" }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Sign out of all other devices" }))
    expect(await screen.findByText("Signed out of 2 other devices.")).toBeInTheDocument()
  })

  it("delete account requires the exact email", async () => {
    signInAs("ada@example.com")
    const user = userEvent.setup()
    const { router } = await renderApp("/account/privacy/delete")
    await user.type(await screen.findByLabelText("Type your email to confirm"), "someone@else.com")
    await user.click(screen.getByRole("button", { name: "Delete my account" }))
    expect(await screen.findByText("This doesn't match your email.")).toBeInTheDocument()
    await user.clear(screen.getByLabelText("Type your email to confirm"))
    await user.type(screen.getByLabelText("Type your email to confirm"), "ada@example.com")
    await user.click(screen.getByRole("button", { name: "Delete my account" }))
    await waitFor(() => expect(router.state.location.pathname).toBe("/deletion-scheduled"))
  })
})
