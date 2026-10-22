import type { ReactNode } from "react"
import { cn } from "@/lib/cn"

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-xs font-semibold tracking-widest text-eyebrow uppercase", className)}>
      {children}
    </p>
  )
}
