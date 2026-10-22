/// <reference types="vite/client" />

declare const __BUILD_ID__: string

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_TURNSTILE_SITE_KEY?: string
  readonly VITE_ENV?: "development" | "test" | "staging" | "production"
  readonly VITE_API_MODE?: "" | "mock" | "live"
}
