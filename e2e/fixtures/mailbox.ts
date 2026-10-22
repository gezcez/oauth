/**
 * Reads sign-in codes from the backend's in-memory mailbox, which exists only in NODE_ENV=test
 * with EMAIL_TRANSPORT=memory: GET /v1/__test/mailbox?to= -> { messages: [{ code, sent_at, ... }] }.
 */
export async function latestCode(apiUrl: string, to: string, since = 0, timeoutMs = 10_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await fetch(`${apiUrl}/v1/__test/mailbox?to=${encodeURIComponent(to)}`)
    if (res.ok) {
      const body = (await res.json()) as { data?: { messages?: { code?: string; sent_at: string }[] } }
      const msg = (body.data?.messages ?? []).filter((m) => m.code && Date.parse(m.sent_at) >= since).at(-1)
      if (msg?.code) return msg.code
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`no code for ${to} within ${timeoutMs} ms`)
}
