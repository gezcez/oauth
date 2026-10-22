import { cn } from "@/lib/cn"

/** The yellow "G" tile plus the lowercase wordmark, as in the www header. */
export function Logo({
  className,
  wordmark = true,
  size = 32,
}: {
  className?: string
  wordmark?: boolean
  size?: number
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold tracking-tight", className)}>
      <img
        src="/logo.png"
        alt=""
        width={size}
        height={size}
        className="rounded-lg"
        style={{ width: size, height: size }}
      />
      {wordmark ? <span className="text-lg">gezcez</span> : <span className="sr-only">gezcez</span>}
    </span>
  )
}
