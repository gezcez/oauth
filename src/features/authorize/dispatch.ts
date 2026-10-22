import type { Next } from "@/api/schema"

export type NextTarget =
  | { kind: "external"; url: string }
  | { kind: "route"; to: "/signin" | "/reauth" | "/choose" | "/consent"; search: { req: string } }
  | { kind: "error"; code: "OAUTH_REQUEST_NOT_FOUND" }

/**
 * Maps the backend's `next` to where the SPA goes. The backend decides; this only routes.
 * `redirect` must come with the API-built `redirect_to`, which is followed untouched.
 * `req` is null when the backend rejected the request before storing it (error redirect).
 */
export function targetForNext(next: Next, req: string | null, redirectTo?: string | null): NextTarget {
  if (next !== "redirect" && !req) return { kind: "error", code: "OAUTH_REQUEST_NOT_FOUND" }
  switch (next) {
    case "redirect":
      return redirectTo
        ? { kind: "external", url: redirectTo }
        : { kind: "error", code: "OAUTH_REQUEST_NOT_FOUND" }
    case "login":
      return { kind: "route", to: "/signin", search: { req: req! } }
    case "reauth":
      return { kind: "route", to: "/reauth", search: { req: req! } }
    case "choose_account":
      return { kind: "route", to: "/choose", search: { req: req! } }
    case "consent":
      return { kind: "route", to: "/consent", search: { req: req! } }
  }
}
