import { useEffect, useState } from "react"
import { Logo } from "./brand/logo"

/** Neutral spinner page: logo pulse, text only after 600 ms so fast paths flash nothing. */
export function FullPageSpinner({ label, delayMs = 600 }: { label?: string; delayMs?: number }) {
  const [showText, setShowText] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setShowText(true), delayMs)
    return () => clearTimeout(id)
  }, [delayMs])
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4" aria-busy="true">
      <span className="motion-safe:animate-pulse-soft">
        <Logo wordmark={false} size={56} />
      </span>
      <p role="status" className="min-h-6 text-muted">
        {showText ? label : ""}
      </p>
    </div>
  )
}
