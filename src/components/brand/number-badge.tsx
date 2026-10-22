import type { ReactNode } from "react"
import { cn } from "@/lib/cn"

/** yellow-400 to amber-500 gradient tile with navy text (www numbered cards, avatars). */
export function NumberBadge({
  children,
  className,
  shape = "tile",
}: {
  children: ReactNode
  className?: string
  shape?: "tile" | "circle"
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-brand-yellow-400 to-brand-amber-500 font-bold text-navy select-none",
        shape === "circle" ? "rounded-full" : "rounded-lg",
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * `decorative`: draw the initials with CSS generated content so they stay out of the accessible
 * name and the visible-label text of a control that already names the person.
 */
export function Avatar({
  initials,
  className,
  decorative,
}: {
  initials: string
  className?: string
  decorative?: boolean
}) {
  const text = initials.slice(0, 2).toUpperCase()
  return (
    <NumberBadge shape="circle" className={cn("size-9 text-sm", className)}>
      {decorative ? (
        <span aria-hidden data-initials={text} className="before:content-[attr(data-initials)]" />
      ) : (
        text
      )}
    </NumberBadge>
  )
}
