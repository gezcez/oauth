import { useRouter } from "@tanstack/react-router"
import { useEffect, useState } from "react"

/**
 * After each navigation: move focus to the page's h1 and announce its text politely, so screen
 * reader and keyboard users land at the start of the new screen (oauth.md 7.4).
 */
export function RouteFocus() {
  const router = useRouter()
  const [message, setMessage] = useState("")
  useEffect(() => {
    let first = true
    return router.subscribe("onResolved", ({ pathChanged }) => {
      if (!pathChanged) return
      if (first) {
        first = false
        return
      }
      requestAnimationFrame(() => {
        const h1 = document.querySelector<HTMLElement>("[data-page-heading]")
        if (h1) {
          h1.focus({ preventScroll: false })
          setMessage(h1.textContent ?? "")
        }
      })
    })
  }, [router])
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  )
}
