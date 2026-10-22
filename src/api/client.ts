import createClient from "openapi-fetch"
import { env } from "@/env"
import { createGezcezFetch } from "@/lib/http"
import type { paths } from "./schema"

/** The one API client. Cookies, CSRF and the envelope are handled in lib/http.ts. */
export const api = createClient<paths>({
  baseUrl: env.apiUrl,
  credentials: "include",
  fetch: createGezcezFetch(env.apiUrl),
})

export { unwrap } from "@/lib/http"
