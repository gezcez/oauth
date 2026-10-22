import { X } from "lucide-react"
import { useEffect, useSyncExternalStore } from "react"
import { useI18n } from "@/i18n"
import { cn } from "@/lib/cn"

/**
 * Minimal flat toasts. Own implementation instead of a library because the CSP forbids
 * injected <style> elements (style-src 'self'). Polite live region; errors are assertive.
 */
interface ToastItem {
  id: number
  message: string
  description?: string | undefined
  tone: "info" | "error"
}

let items: ToastItem[] = []
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function push(tone: ToastItem["tone"], message: string, opts?: { description?: string | undefined }) {
  const item: ToastItem = { id: ++seq, message, description: opts?.description, tone }
  items = [...items.slice(-2), item]
  emit()
  return item.id
}

export function dismiss(id: number) {
  items = items.filter((t) => t.id !== id)
  emit()
}

export const toast = Object.assign((message: string, opts?: { description?: string | undefined }) => push("info", message, opts), {
  error: (message: string, opts?: { description?: string | undefined }) => push("error", message, opts),
})

function useToasts() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => items,
    () => items,
  )
}

export function Toaster() {
  const list = useToasts()
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
      <div role="status" aria-live="polite" className="contents">
        {list.filter((t) => t.tone === "info").map((t) => (
          <ToastView key={t.id} item={t} />
        ))}
      </div>
      <div role="alert" aria-live="assertive" className="contents">
        {list.filter((t) => t.tone === "error").map((t) => (
          <ToastView key={t.id} item={t} />
        ))}
      </div>
    </div>
  )
}

function ToastView({ item }: { item: ToastItem }) {
  const { t } = useI18n()
  useEffect(() => {
    const id = setTimeout(() => dismiss(item.id), item.tone === "error" ? 8000 : 5000)
    return () => clearTimeout(id)
  }, [item])
  return (
    <div
      data-toast
      className={cn(
        "pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl px-4 py-3 text-sm font-medium ring-1 ring-line",
        item.tone === "error" ? "bg-[#7f1d1d] text-white" : "bg-primary text-primary-foreground",
      )}
    >
      <div className="min-w-0 flex-1">
        <p>{item.message}</p>
        {item.description ? <p className="mt-0.5 text-xs opacity-80">{item.description}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        aria-label={t("common.close")}
        className="-m-1 inline-flex size-8 items-center justify-center rounded-full opacity-80 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-focus"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}
