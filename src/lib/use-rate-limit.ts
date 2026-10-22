import { useCallback, useState } from "react"
import { useCountdown } from "./use-countdown"
import { isGezcezError } from "./errors"

/**
 * Tracks a 429 RATE_LIMITED `retry_after`. `track(err)` returns true when it handled the error;
 * `secondsLeft` drives the disabled submit button and its live countdown text.
 */
export function useRateLimit() {
  const [until, setUntil] = useState<number | null>(null)
  const secondsLeft = useCountdown(until)
  const track = useCallback((err: unknown): boolean => {
    if (isGezcezError(err) && err.code === "RATE_LIMITED") {
      const s = Number(err.details.retry_after)
      setUntil(Date.now() + (Number.isFinite(s) && s > 0 ? s : 60) * 1000)
      return true
    }
    return false
  }, [])
  const clear = useCallback(() => setUntil(null), [])
  return { limited: secondsLeft > 0, secondsLeft, track, clear }
}
