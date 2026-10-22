import { forwardRef, type InputHTMLAttributes } from "react"
import { cn } from "@/lib/cn"

export const inputClass =
  "h-12 w-full rounded-xl border border-input-border bg-input px-4 text-base text-foreground placeholder:text-subtle transition-colors focus:border-foreground focus:outline-none focus:ring-2 focus:ring-focus aria-[invalid=true]:border-danger disabled:opacity-60 read-only:bg-surface-muted"

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(inputClass, className)} {...props} />
})
