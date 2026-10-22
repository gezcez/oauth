import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useCallback } from "react"
import { api, unwrap } from "@/api/client"
import { qk } from "@/api/queries"
import type { Next } from "@/api/schema"
import { followRedirect } from "@/lib/navigation"
import { targetForNext } from "./dispatch"

export function startAuthorize(params: Record<string, string>) {
  return unwrap(api.POST("/v1/oauth/authorize", { body: { params } }))
}

export function continueRequest(requestId: string, sessionId?: string) {
  return unwrap(
    api.POST("/v1/oauth/authorize/{requestId}/continue", {
      params: { path: { requestId } },
      body: sessionId ? { session_id: sessionId } : {},
    }),
  )
}

export function decideRequest(requestId: string, decision: "approve" | "deny") {
  return unwrap(
    api.POST("/v1/oauth/authorize/{requestId}/decision", {
      params: { path: { requestId } },
      body: { decision },
    }),
  )
}

/** Navigate wherever the backend's `next` says. Leaving the SPA always uses location.replace. */
export function useDispatchNext() {
  const navigate = useNavigate()
  return useCallback(
    async (next: Next, req: string, redirectTo?: string | null) => {
      const target = targetForNext(next, req, redirectTo)
      if (target.kind === "external") {
        followRedirect(target.url)
        return
      }
      if (target.kind === "error") {
        await navigate({ to: "/error", search: { code: target.code }, replace: true })
        return
      }
      await navigate({ to: target.to, search: target.search, replace: true })
    },
    [navigate],
  )
}

/** After any sign-in step inside an OAuth request: POST continue, then follow `next`. */
export function useContinueRequest() {
  const dispatch = useDispatchNext()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ req, sessionId }: { req: string; sessionId?: string }) => continueRequest(req, sessionId),
    onSuccess: async (res, { req }) => {
      await qc.invalidateQueries({ queryKey: qk.authRequest(req) })
      await dispatch(res.next, req, res.redirect_to)
    },
  })
}
