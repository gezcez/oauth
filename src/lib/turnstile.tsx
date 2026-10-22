import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"
import { env } from "@/env"
import { useI18n } from "@/i18n"
import { GezcezError } from "./errors"

/**
 * Cloudflare Turnstile, managed mode, rendered invisibly ("interaction-only") and executed on
 * submit. The script is loaded lazily the first time a form needs it. In mock mode and with the
 * official always-pass test key under Vitest it returns a fixed token without loading anything.
 *
 * Actions match the backend's expected names: signin, signup, reset, resend, email_change.
 */
export type TurnstileAction = "signin" | "signup" | "reset" | "resend" | "email_change" | "reauth"

export interface TurnstileHandle {
  getToken(): Promise<string>
  reset(): void
}

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string
  execute(id: string): void
  reset(id: string): void
  remove(id: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
let scriptPromise: Promise<TurnstileApi> | null = null

function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const s = document.createElement("script")
    s.src = SCRIPT_URL
    s.async = true
    s.defer = true
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")))
    s.onerror = () => {
      scriptPromise = null
      reject(new Error("turnstile failed to load"))
    }
    document.head.appendChild(s)
  })
  return scriptPromise
}

const bypass = () => env.isMock || import.meta.env.MODE === "test"

export const Turnstile = forwardRef<TurnstileHandle, { action: TurnstileAction }>(function Turnstile(
  { action },
  ref,
) {
  const { locale } = useI18n()
  const el = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const pending = useRef<{ resolve: (t: string) => void; reject: (e: unknown) => void } | null>(null)

  useEffect(() => {
    if (bypass()) return
    let cancelled = false
    loadScript()
      .then((ts) => {
        if (cancelled || !el.current || widget.current) return
        widget.current = ts.render(el.current, {
          sitekey: env.turnstileSiteKey,
          action,
          execution: "execute",
          appearance: "interaction-only",
          language: locale,
          callback: (token: string) => pending.current?.resolve(token),
          "error-callback": () => pending.current?.reject(new GezcezError("AUTH_TURNSTILE_FAILED")),
          "expired-callback": () => widget.current && window.turnstile?.reset(widget.current),
        })
      })
      .catch(() => {
        /* reported when a token is requested */
      })
    return () => {
      cancelled = true
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = null
    }
  }, [action, locale])

  useImperativeHandle(ref, () => ({
    async getToken() {
      if (bypass()) return "mock-turnstile-token"
      const ts = await loadScript().catch(() => {
        throw new GezcezError("AUTH_TURNSTILE_FAILED")
      })
      if (!widget.current) throw new GezcezError("AUTH_TURNSTILE_FAILED")
      const id = widget.current
      return await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new GezcezError("AUTH_TURNSTILE_FAILED")), 60_000)
        pending.current = {
          resolve: (t) => {
            clearTimeout(timer)
            pending.current = null
            resolve(t)
          },
          reject: (e) => {
            clearTimeout(timer)
            pending.current = null
            reject(e)
          },
        }
        ts.execute(id)
      })
    },
    reset() {
      if (widget.current) window.turnstile?.reset(widget.current)
    },
  }))

  if (bypass()) return null
  return <div ref={el} className="empty:hidden [&>div]:mx-auto" />
})
