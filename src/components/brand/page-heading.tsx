import { useEffect, type ReactNode } from "react"
import { cn } from "@/lib/cn"

/**
 * The one h1 per screen. Sets document.title; the root focuses it after navigation and the
 * route announcer reads it.
 */
export function PageHeading({
  children,
  title,
  className,
}: {
  children: ReactNode
  title?: string
  className?: string
}) {
  const text = title ?? (typeof children === "string" ? children : undefined)
  useEffect(() => {
    if (text) document.title = `${text} · gezcez`
  }, [text])
  return (
    <h1
      tabIndex={-1}
      data-page-heading
      className={cn("text-2xl font-bold tracking-tight text-balance sm:text-3xl", className)}
    >
      {children}
    </h1>
  )
}

export function Lead({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-muted", className)}>{children}</p>
}
