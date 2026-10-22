import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"
import createClient from "openapi-fetch"
import type { paths } from "@/api/schema"
import { server } from "@/mocks/node"
import { invalidateCsrfToken } from "./csrf"
import { GezcezError } from "./errors"
import { createGezcezFetch, unwrap } from "./http"

const API = "http://api.test"
const client = () => createClient<paths>({ baseUrl: API, fetch: createGezcezFetch(API) })

describe("lib/http", () => {
  it("unwraps the envelope", async () => {
    server.use(
      http.get(`${API}/v1/account/csrf`, () => HttpResponse.json({ ok: true, data: { token: "t1" } })),
    )
    await expect(unwrap(client().GET("/v1/account/csrf"))).resolves.toEqual({ token: "t1" })
  })

  it("throws GezcezError with code, details and request id", async () => {
    server.use(
      http.post(`${API}/v1/account/email/start`, () =>
        HttpResponse.json(
          {
            ok: false,
            error: {
              code: "RATE_LIMITED",
              message: "slow down",
              details: { retry_after: 90 },
              request_id: "req_1",
            },
          },
          { status: 429 },
        ),
      ),
      http.get(`${API}/v1/account/csrf`, () => HttpResponse.json({ ok: true, data: { token: "t" } })),
    )
    const err = await unwrap(
      client().POST("/v1/account/email/start", { body: { email: "a@b.co", intent: "signin", locale: "en" } }),
    ).catch((e) => e)
    expect(err).toBeInstanceOf(GezcezError)
    expect(err.code).toBe("RATE_LIMITED")
    expect(err.status).toBe(429)
    expect(err.details.retry_after).toBe(90)
    expect(err.requestId).toBe("req_1")
  })

  it("sends the CSRF header and JSON content type on writes, not on reads", async () => {
    const seen: Record<string, string | null>[] = []
    server.use(
      http.get(`${API}/v1/account/csrf`, () => HttpResponse.json({ ok: true, data: { token: "tok-1" } })),
      http.get(`${API}/v1/account/session`, ({ request }) => {
        seen.push({ csrf: request.headers.get("x-csrf-token") })
        return HttpResponse.json(
          { ok: false, error: { code: "AUTH_SESSION_REQUIRED", message: "", request_id: "r" } },
          { status: 401 },
        )
      }),
      http.post(`${API}/v1/account/session/switch`, ({ request }) => {
        seen.push({ csrf: request.headers.get("x-csrf-token"), type: request.headers.get("content-type") })
        return HttpResponse.json({ ok: true, data: { account: {} } })
      }),
    )
    invalidateCsrfToken()
    await client().GET("/v1/account/session")
    await client().POST("/v1/account/session/switch", { body: { session_id: "s" } })
    expect(seen[0]!.csrf).toBeNull()
    expect(seen[1]!.csrf).toBe("tok-1")
    expect(seen[1]!.type).toContain("application/json")
  })

  it("refetches the CSRF token and retries exactly once on CSRF_INVALID", async () => {
    let tokens = 0
    let posts = 0
    server.use(
      http.get(`${API}/v1/account/csrf`, () =>
        HttpResponse.json({ ok: true, data: { token: `tok-${++tokens}` } }),
      ),
      http.post(`${API}/v1/account/session/switch`, ({ request }) => {
        posts++
        if (request.headers.get("x-csrf-token") !== "tok-2")
          return HttpResponse.json(
            { ok: false, error: { code: "CSRF_INVALID", message: "", request_id: "r" } },
            { status: 403 },
          )
        return HttpResponse.json({ ok: true, data: { account: { id: "x" } } })
      }),
    )
    invalidateCsrfToken()
    const res = await unwrap(client().POST("/v1/account/session/switch", { body: { session_id: "s" } }))
    expect(res).toEqual({ account: { id: "x" } })
    expect(posts).toBe(2)
    expect(tokens).toBe(2)
  })

  it("gives up after the second CSRF_INVALID", async () => {
    let posts = 0
    server.use(
      http.get(`${API}/v1/account/csrf`, () =>
        HttpResponse.json({ ok: true, data: { token: "never-valid" } }),
      ),
      http.post(`${API}/v1/account/session/switch`, () => {
        posts++
        return HttpResponse.json(
          { ok: false, error: { code: "CSRF_INVALID", message: "", request_id: "r" } },
          { status: 403 },
        )
      }),
    )
    invalidateCsrfToken()
    const err = await unwrap(
      client().POST("/v1/account/session/switch", { body: { session_id: "s" } }),
    ).catch((e) => e)
    expect(err.code).toBe("CSRF_INVALID")
    expect(posts).toBe(2)
  })

  it("maps network failures to NETWORK", async () => {
    server.use(http.get(`${API}/v1/account/session`, () => HttpResponse.error()))
    const err = await unwrap(client().GET("/v1/account/session")).catch((e) => e)
    expect(err).toBeInstanceOf(GezcezError)
    expect(err.code).toBe("NETWORK")
  })

  it("maps a bare 5xx without envelope to INTERNAL with the request id header", async () => {
    server.use(
      http.get(
        `${API}/v1/account/session`,
        () => new HttpResponse("oops", { status: 502, headers: { "x-request-id": "cf-123" } }),
      ),
    )
    const err = await unwrap(client().GET("/v1/account/session")).catch((e) => e)
    expect(err.code).toBe("INTERNAL")
    expect(err.requestId).toBe("cf-123")
  })
})
