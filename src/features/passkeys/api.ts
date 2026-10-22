import { api, unwrap } from "@/api/client"
import type { PasskeyAssertion, PasskeyAttestation } from "@/api/schema"

export function passkeySignInOptions(requestId?: string) {
  return unwrap(
    api.POST("/v1/account/passkeys/signin/options", { body: requestId ? { request_id: requestId } : {} }),
  )
}

export function passkeySignInVerify(body: { challenge_id: string; credential: PasskeyAssertion }) {
  return unwrap(api.POST("/v1/account/passkeys/signin/verify", { body }))
}

export function passkeyRegisterOptions() {
  return unwrap(api.POST("/v1/account/passkeys/options"))
}

export function passkeyRegister(body: {
  challenge_id: string
  credential: PasskeyAttestation
  name: string
}) {
  return unwrap(api.POST("/v1/account/passkeys", { body }))
}

export function renamePasskey(passkeyId: string, name: string) {
  return unwrap(
    api.PATCH("/v1/account/passkeys/{passkeyId}", { params: { path: { passkeyId } }, body: { name } }),
  )
}

export function deletePasskey(passkeyId: string) {
  return unwrap(api.DELETE("/v1/account/passkeys/{passkeyId}", { params: { path: { passkeyId } } }))
}
