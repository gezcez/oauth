import { passkeyRegister, passkeyRegisterOptions } from "./api"
import { startRegistration } from "./webauthn"

/**
 * oauth.md 5.11 registration: options (sudo), navigator.credentials.create() through
 * @simplewebauthn/browser, then save under the name the user picked.
 */
export async function registerPasskey(name: string) {
  const { challenge_id, ...optionsJSON } = await passkeyRegisterOptions()
  const credential = await startRegistration({ optionsJSON })
  return passkeyRegister({ challenge_id, credential, name })
}
