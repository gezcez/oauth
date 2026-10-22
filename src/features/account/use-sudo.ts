import { useQuery } from "@tanstack/react-query"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { useCallback } from "react"
import { sessionQuery } from "@/api/queries"

/** Step-up window from backend 6.1.6, minus a little slack for clock skew. */
const STEP_UP_S = 600
const SLACK_S = 30

/**
 * Before a sensitive action: if the session's auth_time is older than the step-up window, go to
 * /reauth?return=<this page> first instead of letting the request fail. The backend still
 * enforces it (AUTH_STEP_UP_REQUIRED is handled by useHandleApiError the same way).
 */
export function useSudo() {
  const session = useQuery(sessionQuery)
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  return useCallback((): boolean => {
    const at = session.data?.session.auth_time
    const fresh = at ? (Date.now() - new Date(at).getTime()) / 1000 < STEP_UP_S - SLACK_S : false
    if (!fresh) void navigate({ to: "/reauth", search: { return: href } })
    return fresh
  }, [session.data, navigate, href])
}
