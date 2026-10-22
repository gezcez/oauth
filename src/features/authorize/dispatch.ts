import type { Next } from "@/api/schema"

export type NextTarget =
  | { kind: "external"; url: string }
  | { kind: "route"; to: "/signin" | "/reauth" | "/choose" | "/consent"; search: { req: string } }
  | { kind: "error"; code: "OAUTH_REQUEST_NOT_FOUND" }

/**
 * Maps the backend's `next` to where the SPA goes. The backend decides; this only routes.
 * `redirect` must come with the API-built `redirect_to`, which is followed untouched.
 */
export function targetForNext(next: Next, req: string, redirectTo?: string | null): NextTarget {
  switch (next) {
    case "redirect":
      return redirectTo
        ? { kind: "external", url: redirectTo }
        : { kind: "error", code: "OAUTH_REQUEST_NOT_FOUND" }
    case "login":
      return { kind: "route", to: "/signin", search: { req } }
    case "reauth":
      return { kind: "route", to: "/reauth", search: { req } }
    case "choose_account":
      return { kind: "route", to: "/choose", search: { req } }
    case "consent":
      return { kind: "route", to: "/consent", search: { req } }
  }
}
