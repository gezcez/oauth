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

export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <NumberBadge shape="circle" className={cn("size-9 text-sm", className)}>
      {initials.slice(0, 2).toUpperCase()}
    </NumberBadge>
  )
}
