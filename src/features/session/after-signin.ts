import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { continueRequest, useDispatchNext } from "@/features/authorize/api"
import { invalidateCsrfToken } from "@/lib/csrf"
import { secretStore } from "@/lib/flow-memory"
import { useInternalNav } from "@/lib/use-internal-nav"

/**
 * After any successful sign-in (code, password, sign-up, reset, re-auth): the session cookie and
 * therefore the CSRF token changed. Inside an OAuth request, POST continue and follow `next`;
 * otherwise go to `return` (internal only) or /account.
 */
export function useAfterSignIn() {
  const qc = useQueryClient()
  const go = useInternalNav()
  const dispatch = useDispatchNext()
  return useCallback(
    async (opts: { req?: string | undefined; returnTo?: string | undefined; welcome?: boolean }) => {
      invalidateCsrfToken()
      await qc.invalidateQueries({ queryKey: ["account"] })
      if (opts.req) {
        const res = await continueRequest(opts.req)
        await dispatch(res.next, opts.req, res.redirect_to)
        return
      }
      if (opts.welcome) secretStore.set("welcome", true)
      go(opts.returnTo ?? "/account", { replace: true })
    },
    [qc, go, dispatch],
  )
}
