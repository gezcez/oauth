import { z } from "zod"

const EnvSchema = z.object({
  VITE_API_URL: z.string().optional().default(""),
  VITE_TURNSTILE_SITE_KEY: z.string().optional().default("1x00000000000000000000AA"),
  VITE_ENV: z.enum(["development", "test", "staging", "production"]).optional().default("development"),
  VITE_API_MODE: z.enum(["", "mock", "live"]).optional().default(""),
})

const raw = EnvSchema.parse(import.meta.env)

// Read straight from import.meta.env so Vite folds it to a constant and production builds drop
// the MSW worker and the mock panel entirely.
export const isMock = import.meta.env.VITE_API_MODE === "mock" || import.meta.env.MODE === "mock"

function apiUrl(): string {
  const configured = raw.VITE_API_URL.replace(/\/+$/, "")
  if (configured) return configured
  if (typeof window !== "undefined") return window.location.origin
  return "http://localhost"
}

export const env = {
  apiUrl: apiUrl(),
  turnstileSiteKey: raw.VITE_TURNSTILE_SITE_KEY,
  appEnv: raw.VITE_ENV,
  isMock,
  buildId: typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev",
  wwwUrl: "https://www.gezcez.com",
  supportEmail: "info@gezcez.com",
  statusUrl: "https://status.gezcez.com",
} as const
