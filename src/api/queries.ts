import { queryOptions } from "@tanstack/react-query"
import { isGezcezError } from "@/lib/errors"
import { api, unwrap } from "./client"
import type { SessionInfo } from "./schema"

export const qk = {
  session: ["account", "session"] as const,
  deviceAccounts: ["account", "device-accounts"] as const,
  authRequest: (id: string) => ["oauth", "authorize", id] as const,
  profile: ["account", "profile"] as const,
  sessions: ["account", "sessions"] as const,
  apps: ["account", "apps"] as const,
  security: ["account", "security"] as const,
  privacy: ["account", "privacy"] as const,
  exports: ["account", "exports"] as const,
}

/** Current identity session, or null when signed out (401 AUTH_SESSION_REQUIRED). */
export const sessionQuery = queryOptions({
  queryKey: qk.session,
  queryFn: async (): Promise<SessionInfo | null> => {
    try {
      return await unwrap(api.GET("/v1/account/session"))
    } catch (e) {
      if (
        isGezcezError(e) &&
        (e.code === "AUTH_SESSION_REQUIRED" ||
          e.code === "AUTH_REQUIRED" ||
          e.code === "AUTH_SESSION_REVOKED")
      )
        return null
      throw e
    }
  },
  staleTime: 30_000,
})

export const deviceAccountsQuery = queryOptions({
  queryKey: qk.deviceAccounts,
  queryFn: () => unwrap(api.GET("/v1/account/device-accounts")),
})

export const authRequestQuery = (requestId: string) =>
  queryOptions({
    queryKey: qk.authRequest(requestId),
    queryFn: () => unwrap(api.GET("/v1/oauth/authorize/{requestId}", { params: { path: { requestId } } })),
    staleTime: 0,
  })

export const profileQuery = queryOptions({
  queryKey: qk.profile,
  queryFn: () => unwrap(api.GET("/v1/account/profile")),
})

export const sessionsQuery = queryOptions({
  queryKey: qk.sessions,
  queryFn: () => unwrap(api.GET("/v1/account/sessions")),
})

export const appsQuery = queryOptions({
  queryKey: qk.apps,
  queryFn: () => unwrap(api.GET("/v1/account/apps")),
})

export const securityQuery = queryOptions({
  queryKey: qk.security,
  queryFn: () => unwrap(api.GET("/v1/account/security")),
})

export const privacyQuery = queryOptions({
  queryKey: qk.privacy,
  queryFn: () => unwrap(api.GET("/v1/account/privacy")),
})

export const exportsQuery = queryOptions({
  queryKey: qk.exports,
  queryFn: () => unwrap(api.GET("/v1/account/export")),
  refetchInterval: (q) => (q.state.data?.exports.some((e) => e.status === "queued") ? 3000 : false),
})
