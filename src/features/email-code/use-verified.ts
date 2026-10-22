import { useNavigate } from "@tanstack/react-router"
import type { EmailVerifyResult } from "@/api/schema"
import { useAfterSignIn } from "@/features/session/after-signin"
import { flowStore, secretStore } from "@/lib/flow-memory"

/** What happens after a correct code in the sign-in / sign-up flow (oauth.md 5.2 step 5). */
export function useVerifiedHandler(req: string | undefined, returnTo: string | undefined) {
  const after = useAfterSignIn()
  const navigate = useNavigate()
  return async (res: EmailVerifyResult) => {
    if (res.status === "signed_in") return after({ req, returnTo })
    if (res.status === "needs_profile") {
      secretStore.set("profileToken", {
        token: res.profile_token,
        email: res.email ?? flowStore.lastEmail(),
        req,
        returnTo,
      })
      return navigate({ to: "/signup/profile", search: { req, return: returnTo } })
    }
    // reset_ready only comes from the reset flow; treat it like a reset.
    secretStore.set("resetToken", { token: res.reset_token, req })
    return navigate({ to: "/reset/new", search: { req } })
  }
}
