/**
 * Synchronizer CSRF token from GET /v1/account/csrf (HMAC of the session id, or of the device id
 * before sign-in). Cached in memory, refetched after sign-in changes the session and once on a
 * CSRF_INVALID response.
 */
let token: string | null = null
let inflight: Promise<string> | null = null

export function getCsrfToken(apiUrl: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  if (token) return Promise.resolve(token)
  inflight ??= (async () => {
    const res = await fetchImpl(`${apiUrl}/v1/account/csrf`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    })
    const body = (await res.json().catch(() => null)) as { ok?: boolean; data?: { token?: string } } | null
    const value = body?.data?.token
    if (!res.ok || !value) throw new TypeError("Could not load CSRF token")
    token = value
    return value
  })().finally(() => {
    inflight = null
  })
  return inflight
}

export function invalidateCsrfToken(): void {
  token = null
}
