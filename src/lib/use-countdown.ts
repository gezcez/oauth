import { useEffect, useState } from "react"

/** Whole seconds left until `untilMs` (0 when passed or null). Ticks once a second. */
export function useCountdown(untilMs: number | null | undefined): number {
  const calc = () => (untilMs ? Math.max(0, Math.ceil((untilMs - Date.now()) / 1000)) : 0)
  const [left, setLeft] = useState(calc)
  useEffect(() => {
    setLeft(calc())
    if (!untilMs) return
    const id = setInterval(() => {
      const v = calc()
      setLeft(v)
      if (v <= 0) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [untilMs])
  return left
}
