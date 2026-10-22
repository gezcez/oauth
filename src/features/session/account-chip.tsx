import type { AccountSummary } from "@/api/schema"
import { Avatar } from "@/components/brand/number-badge"
import { cn } from "@/lib/cn"

/** rounded-full chip: gradient initials circle plus the masked email. */
export function AccountChip({ account, className }: { account: AccountSummary; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-full bg-surface-muted py-1 pr-3 pl-1 ring-1 ring-line",
        className,
      )}
    >
      <Avatar initials={account.avatar_initials} className="size-8 text-xs" />
      <span className="min-w-0 truncate text-sm">
        <span className="font-semibold">{account.display_name}</span>
        <span className="text-muted"> · {account.email_masked}</span>
      </span>
    </span>
  )
}
