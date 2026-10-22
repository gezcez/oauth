import type { ReactNode } from "react"
import { Lead, PageHeading } from "@/components/brand/page-heading"
import { Card } from "@/components/ui/card"
import { FormError } from "@/components/form-error"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n"
import { cn } from "@/lib/cn"

export function AccountPage({
  title,
  lead,
  children,
  aside,
}: {
  title: string
  lead?: ReactNode
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <PageHeading>{title}</PageHeading>
          {lead ? <Lead>{lead}</Lead> : null}
        </div>
        {aside}
      </div>
      {children}
    </div>
  )
}

export function Section({
  title,
  children,
  className,
  description,
  id,
}: {
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  const headingId = id ? `${id}-title` : undefined
  return (
    <Card
      className={cn("space-y-4", className)}
      aria-labelledby={headingId}
      role={title ? "region" : undefined}
    >
      {title ? (
        <div className="space-y-1">
          <h2 id={headingId} className="text-lg font-bold tracking-tight">
            {title}
          </h2>
          {description ? <p className="text-sm text-muted">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </Card>
  )
}

export function Loading() {
  const { t } = useI18n()
  return (
    // A skeleton of the page (heading, lead, cards) so the layout does not jump when data lands.
    <div role="status" aria-label={t("common.loading")} aria-busy className="space-y-6">
      <div className="space-y-3">
        <div className="h-8 w-1/2 rounded-lg bg-line motion-safe:animate-pulse" />
        <div className="h-4 w-2/3 rounded-md bg-line motion-safe:animate-pulse" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-line motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  )
}

export function LoadError({ error, retry }: { error: unknown; retry: () => void }) {
  const { t } = useI18n()
  return (
    <FormError
      error={error}
      action={
        <Button size="sm" variant="secondary" onClick={retry}>
          {t("common.retry")}
        </Button>
      }
    />
  )
}
