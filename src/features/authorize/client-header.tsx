import type { ClientInfo } from "@/api/schema"
import { NumberBadge } from "@/components/brand/number-badge"
import { initialsOf } from "@/lib/mask"
import { cn } from "@/lib/cn"

const ALLOWED_LOGO_HOSTS = ["assets.gezcez.com"]

/** Client logos only from our own asset host (CSP img-src); otherwise a gradient initials tile. */
export function ClientLogo({
  client,
  size = 40,
  className,
}: {
  client: Pick<ClientInfo, "name" | "logo_url">
  size?: number
  className?: string
}) {
  let logo: string | null = null
  if (client.logo_url) {
    try {
      const u = new URL(client.logo_url)
      if (u.protocol === "https:" && ALLOWED_LOGO_HOSTS.includes(u.hostname)) logo = u.toString()
    } catch {
      logo = null
    }
  }
  if (logo) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center overflow-hidden rounded-xl bg-surface ring-1 ring-line",
          className,
        )}
        style={{ width: size, height: size }}
      >
        <img src={logo} alt="" width={size} height={size} className="size-full object-cover" />
      </span>
    )
  }
  return (
    <NumberBadge className={cn("rounded-xl text-sm", className)}>
      <span style={{ width: size, height: size }} className="inline-flex items-center justify-center">
        {initialsOf(client.name)}
      </span>
    </NumberBadge>
  )
}
