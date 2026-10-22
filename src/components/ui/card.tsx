import type { HTMLAttributes } from "react"
import { cn } from "@/lib/cn"

/** rounded-2xl, white on cream (white/5 on navy), a hairline ring, no shadow. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl bg-surface p-6 ring-1 ring-line", className)} {...props} />
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("text-lg font-bold tracking-tight", className)} {...props}>
      {children}
    </h2>
  )
}
