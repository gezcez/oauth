import { Slot } from "@radix-ui/react-slot"
import { X } from "lucide-react"
import { createContext, useContext, useEffect, useId, useRef, type ReactNode } from "react"
import { useI18n } from "@/i18n"
import { cn } from "@/lib/cn"

/**
 * Native <dialog> with showModal(): focus trap, Escape, inert background and top layer come
 * from the browser, and nothing injects <style> elements (the CSP has style-src 'self').
 */
const Ctx = createContext<{ close: () => void; titleId: string; descId: string } | null>(null)

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      document.documentElement.style.overflow = "hidden"
    } else if (!open && d.open) d.close()
    if (!open) document.documentElement.style.overflow = ""
    return () => {
      document.documentElement.style.overflow = ""
    }
  }, [open])
  return (
    // Backdrop click closes; the keyboard equivalent is Escape (onCancel) and the close button.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onClose={() => onOpenChange(false)}
      onCancel={(e) => {
        e.preventDefault()
        onOpenChange(false)
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false)
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md bg-transparent p-0 text-foreground backdrop:bg-navy/50"
    >
      {open ? (
        <Ctx.Provider value={{ close: () => onOpenChange(false), titleId, descId }}>{children}</Ctx.Provider>
      ) : null}
    </dialog>
  )
}

export function DialogContent({
  title,
  description,
  children,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const { t } = useI18n()
  const ctx = useContext(Ctx)!
  return (
    <div className={cn("relative rounded-2xl bg-background p-6 ring-1 ring-line", className)}>
      <div className="pr-10">
        <h2 id={ctx.titleId} className="text-xl font-bold tracking-tight">
          {title}
        </h2>
        <div id={ctx.descId} className={description ? "mt-2 text-muted" : "sr-only"}>
          {description ?? title}
        </div>
      </div>
      {children ? <div className="mt-6">{children}</div> : null}
      <button
        type="button"
        onClick={ctx.close}
        className="absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-full text-muted hover:bg-secondary-hover focus-visible:outline-2 focus-visible:outline-focus"
        aria-label={t("common.close")}
      >
        <X className="size-5" aria-hidden />
      </button>
    </div>
  )
}

export function DialogClose({ children }: { children: ReactNode; asChild?: boolean }) {
  const ctx = useContext(Ctx)!
  return <Slot onClick={ctx.close}>{children}</Slot>
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{children}</div>
}
