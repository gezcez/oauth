/**
 * PKCE and state for the e2e test client (oauth.md 9.3). Test scaffolding that follows the
 * client contract; the real implementations live in the dashboard and mobile repos.
 */

function base64url(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function randomBase64url(length: number): string {
  return base64url(crypto.getRandomValues(new Uint8Array(length)))
}

/** 32 random bytes, base64url: 43 characters. */
export function createVerifier(): string {
  return randomBase64url(32)
}

/** S256 only; `plain` is never produced. */
export async function challengeS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(digest))
}

/** 16 random bytes, base64url: 22 characters. */
export function createState(): string {
  return randomBase64url(16)
}
