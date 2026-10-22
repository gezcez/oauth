import type { ReactNode } from "react"
import { Eyebrow } from "./brand/eyebrow"
import { Lead, PageHeading } from "./brand/page-heading"

export function AuthHeader({
  eyebrow,
  title,
  lead,
  icon,
}: {
  eyebrow?: ReactNode
  title: string
  lead?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="mb-6 space-y-3">
      {icon}
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <PageHeading>{title}</PageHeading>
      {lead ? <Lead>{lead}</Lead> : null}
    </div>
  )
}
