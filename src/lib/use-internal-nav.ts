import { useRouter } from "@tanstack/react-router"
import { useCallback } from "react"
import { safeInternalPath } from "./navigation"

/** Navigate to an internal path that may carry its own query string (`return=` values). */
export function useInternalNav() {
  const router = useRouter()
  return useCallback(
    (path: string | undefined, opts: { replace?: boolean } = {}) => {
      const safe = safeInternalPath(path ?? "/")
      if (opts.replace) router.history.replace(safe)
      else router.history.push(safe)
    },
    [router],
  )
}
