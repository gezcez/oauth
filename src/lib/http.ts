import { getCsrfToken, invalidateCsrfToken } from "./csrf"
import { GezcezError, type ClientErrorCode, type ErrorDetails } from "./errors"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

/**
 * fetch used by the openapi-fetch client. For every call it sends cookies; for writes it adds
 * the CSRF header and a JSON content type, and retries exactly once after refreshing the token
 * when the API answers CSRF_INVALID. Network failures become GezcezError("NETWORK").
 */
export function createGezcezFetch(apiUrl: string, baseFetch: typeof fetch = (...a) => fetch(...a)) {
  async function send(request: Request, forceToken: boolean): Promise<Response> {
    const req = new Request(request, { credentials: "include" })
    if (!SAFE_METHODS.has(req.method.toUpperCase())) {
      if (forceToken) invalidateCsrfToken()
      const csrf = await getCsrfToken(apiUrl, baseFetch).catch(() => {
        throw new GezcezError("NETWORK", { message: "CSRF token unavailable" })
      })
      req.headers.set("X-CSRF-Token", csrf)
      if (!req.headers.has("Content-Type")) req.headers.set("Content-Type", "application/json")
    }
    req.headers.set("Accept", "application/json")
    try {
      return await baseFetch(req)
    } catch (e) {
      throw new GezcezError("NETWORK", { message: e instanceof Error ? e.message : "Network error" })
    }
  }

  return async function gezcezFetch(input: Request): Promise<Response> {
    const retryCopy = SAFE_METHODS.has(input.method.toUpperCase()) ? null : input.clone()
    const res = await send(input, false)
    if (res.status === 403 && retryCopy) {
      const code = await peekErrorCode(res)
      if (code === "CSRF_INVALID") return send(retryCopy, true)
    }
    return res
  }
}

async function peekErrorCode(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.clone().json()) as { error?: { code?: string } }
    return body?.error?.code
  } catch {
    return undefined
  }
}

interface FetchResult<T> {
  data?: { ok: true; data: T } | undefined
  error?: unknown
  response: Response
}

/** Turn an openapi-fetch result into the envelope's `data`, or throw a GezcezError. */
export async function unwrap<T>(promise: Promise<FetchResult<T>>): Promise<T> {
  const { data, error, response } = await promise
  if (response.ok && data && data.ok) return data.data
  throw errorFromBody(error, response)
}

export function errorFromBody(body: unknown, response: Response): GezcezError {
  const requestId = response.headers.get("x-request-id") ?? undefined
  const err = (
    body as { error?: { code?: string; message?: string; details?: ErrorDetails; request_id?: string } }
  )?.error
  if (err?.code) {
    return new GezcezError(err.code as ClientErrorCode, {
      message: err.message,
      status: response.status,
      details: err.details ?? {},
      requestId: err.request_id ?? requestId,
    })
  }
  const code: ClientErrorCode =
    response.status === 429
      ? "RATE_LIMITED"
      : response.status === 404
        ? "NOT_FOUND"
        : response.status >= 500
          ? "INTERNAL"
          : "UNKNOWN"
  const retry = Number(response.headers.get("retry-after"))
  return new GezcezError(code, {
    status: response.status,
    requestId,
    details: Number.isFinite(retry) && retry > 0 ? { retry_after: retry } : {},
  })
}
