/**
 * The only module that touches @simplewebauthn/browser, so tests can replace the browser
 * ceremony with `vi.mock("@/features/passkeys/webauthn")`.
 */
import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  sendSignal,
  startAuthentication,
  startRegistration,
  WebAuthnAbortService,
  WebAuthnError,
} from "@simplewebauthn/browser"

export { browserSupportsWebAuthnAutofill, startAuthentication, startRegistration }

/** True when the browser has the WebAuthn API at all (the passkey button's condition). */
export function supportsPasskeys(): boolean {
  return browserSupportsWebAuthn()
}

/** Stop a pending conditional (autofill) request, for example when leaving the sign-in page. */
export function cancelCeremony(): void {
  WebAuthnAbortService.cancelCeremony()
}

/** Best effort: ask the browser to hide a passkey the backend no longer knows. */
export function signalUnknownPasskey(rpID: string, credentialID: string): void {
  sendSignal({ signalName: "unknownCredential", rpID, credentialID }).catch(() => {})
}

/**
 * What went wrong in the browser half of a ceremony, in the terms the UI needs:
 * - cancelled: the user closed the sheet, it timed out, or no passkey was available
 * - exists: this authenticator already holds a passkey for this account (registration)
 * - unsupported: the browser or device cannot do what the options ask
 * - failed: anything else (wrong domain, authenticator error)
 */
export type CeremonyFailure = "cancelled" | "exists" | "unsupported" | "failed"

export function ceremonyFailure(e: unknown): CeremonyFailure | null {
  const name =
    e instanceof Error ? (e instanceof WebAuthnError ? (e.cause as Error | undefined)?.name : e.name) : ""
  if (e instanceof WebAuthnError) {
    if (e.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") return "exists"
    if (e.code === "ERROR_CEREMONY_ABORTED") return "cancelled"
    if (
      e.code === "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT" ||
      e.code === "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT" ||
      e.code === "ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG"
    )
      return "unsupported"
  }
  switch (name) {
    case "NotAllowedError":
    case "AbortError":
      return "cancelled"
    case "InvalidStateError":
      return "exists"
    case "NotSupportedError":
      return "unsupported"
    case "SecurityError":
    case "ConstraintError":
    case "UnknownError":
      return "failed"
  }
  if (e instanceof WebAuthnError) return "failed"
  // Thrown by simplewebauthn itself when WebAuthn is missing.
  if (e instanceof Error && /does not support WebAuthn/i.test(e.message)) return "unsupported"
  return null
}
