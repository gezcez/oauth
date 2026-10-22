import { createHash, randomBytes } from "node:crypto"

/** RFC 7636 helpers for the e2e test client. */
export function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function createVerifier(bytes = 32): string {
  return base64url(randomBytes(bytes))
}

export function challengeFor(verifier: string): string {
  return base64url(createHash("sha256").update(verifier, "ascii").digest())
}
