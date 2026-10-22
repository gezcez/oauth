import { cva, type VariantProps } from "class-variance-authority"
import { AlertCircle, CheckCircle2, Info } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/cn"

const alertVariants = cva("flex gap-3 rounded-xl px-4 py-3 text-sm", {
  variants: {
    tone: {
      error: "bg-danger-bg text-danger",
      info: "bg-info-bg text-foreground",
      success: "bg-success-bg text-success",
    },
  },
  defaultVariants: { tone: "info" },
})

export function Alert({
  tone,
  children,
  className,
  live = true,
  action,
}: VariantProps<typeof alertVariants> & {
  children: ReactNode
  className?: string
  live?: boolean
  action?: ReactNode
}) {
  const Icon = tone === "error" ? AlertCircle : tone === "success" ? CheckCircle2 : Info
  return (
    <div
      role={live ? (tone === "error" ? "alert" : "status") : undefined}
      className={cn(alertVariants({ tone }), className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <div>{children}</div>
        {action}
      </div>
    </div>
  )
}
