import { useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { useAfterSignIn } from "@/features/session/after-signin"
import { isGezcezError } from "@/lib/errors"
import { secretStore } from "@/lib/flow-memory"
import { passkeySignInOptions, passkeySignInVerify } from "./api"
import {
  browserSupportsWebAuthnAutofill,
  cancelCeremony,
  ceremonyFailure,
  signalUnknownPasskey,
  startAuthentication,
  supportsPasskeys,
  type CeremonyFailure,
} from "./webauthn"

/** The backend does not know this credential (removed passkey, or one for another site). */
const UNKNOWN_CREDENTIAL = new Set(["NOT_FOUND"])
/** The assertion was rejected: expired or reused challenge, bad signature, counter rollback. */
const REJECTED = new Set(["VALIDATION_FAILED", "AUTH_TOKEN_INVALID", "AUTH_TOKEN_EXPIRED"])

export type PasskeySignInProblem =
  { kind: "ceremony"; failure: CeremonyFailure } | { kind: "unknown" } | { kind: "api"; error: unknown }

async function signInWithPasskey(req: string | undefined, autofill: boolean) {
  const { challenge_id, ...optionsJSON } = await passkeySignInOptions(req)
  const credential = await startAuthentication({ optionsJSON, useBrowserAutofill: autofill })
  try {
    return await passkeySignInVerify({ challenge_id, credential })
  } catch (e) {
    if (isGezcezError(e) && e.code === "NOT_FOUND" && optionsJSON.rpId)
      signalUnknownPasskey(optionsJSON.rpId, credential.id)
    throw e
  }
}

/**
 * oauth.md 5.11: "Sign in with a passkey" button plus conditional UI. While the sign-in page is
 * open and the browser supports it, a conditional request waits for the user to pick a passkey
 * from the email field's autofill sheet. Pressing the button replaces it with a modal request.
 */
export function usePasskeySignIn({
  req,
  returnTo,
  conditional = true,
}: {
  req?: string | undefined
  returnTo?: string | undefined
  conditional?: boolean
}) {
  const navigate = useNavigate()
  const after = useAfterSignIn()
  const [supported] = useState(supportsPasskeys)
  const [pending, setPending] = useState(false)
  const [problem, setProblem] = useState<PasskeySignInProblem | null>(null)
  // Bumped after a modal attempt ends so the conditional request starts again.
  const [round, setRound] = useState(0)
  const busy = useRef(false)

  const fail = useCallback(
    (e: unknown, quietCancel: boolean) => {
      const failure = ceremonyFailure(e)
      if (failure) {
        if (!(quietCancel && failure === "cancelled")) setProblem({ kind: "ceremony", failure })
        return
      }
      if (isGezcezError(e) && e.code === "USER_BANNED") {
        secretStore.set("banned", e.details)
        void navigate({ to: "/banned", search: { req }, replace: true })
      } else if (isGezcezError(e) && e.code === "USER_PENDING_DELETION") {
        secretStore.set("pendingDeletion", e.details)
        void navigate({ to: "/pending-deletion", search: { req }, replace: true })
      } else if (isGezcezError(e) && UNKNOWN_CREDENTIAL.has(e.code)) {
        setProblem({ kind: "unknown" })
      } else if (isGezcezError(e) && REJECTED.has(e.code)) {
        setProblem({ kind: "ceremony", failure: "failed" })
      } else {
        setProblem({ kind: "api", error: e })
      }
    },
    [navigate, req],
  )

  // The conditional request lives as long as the page; read the latest callbacks through a ref
  // so a re-render does not restart it (each start fetches a new challenge).
  const latest = useRef({ req, returnTo, after, fail })
  useEffect(() => {
    latest.current = { req, returnTo, after, fail }
  })

  useEffect(() => {
    if (!conditional || !supported) return
    let live = true
    void (async () => {
      if (!(await browserSupportsWebAuthnAutofill().catch(() => false)) || !live) return
      try {
        await signInWithPasskey(latest.current.req, true)
      } catch (e) {
        // Aborted because the button took over or the page closed: nothing to say.
        if (live && !busy.current) latest.current.fail(e, true)
        return
      }
      if (!live) return
      busy.current = true
      setPending(true)
      try {
        await latest.current.after({ req: latest.current.req, returnTo: latest.current.returnTo })
      } catch (e) {
        busy.current = false
        setPending(false)
        latest.current.fail(e, false)
      }
    })()
    return () => {
      live = false
      if (!busy.current) cancelCeremony()
    }
  }, [conditional, supported, round])

  const start = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setProblem(null)
    try {
      await signInWithPasskey(req, false)
      await after({ req, returnTo })
    } catch (e) {
      busy.current = false
      setPending(false)
      fail(e, false)
      setRound((r) => r + 1)
    }
  }, [req, returnTo, after, fail])

  return { supported, pending, problem, start }
}
