import type { AuthRequestSnapshot } from "@/api/schema"
import { Eyebrow } from "@/components/brand/eyebrow"
import { useI18n } from "@/i18n"
import { ClientLogo } from "./client-header"

/** "SIGN IN TO DASHBOARD" with the client tile when an OAuth request is in progress. */
export function ClientEyebrow({
  request,
  fallback,
  template = "auth.eyebrow.signinTo",
}: {
  request: AuthRequestSnapshot | undefined
  fallback: string
  template?: "auth.eyebrow.signinTo"
}) {
  const { t } = useI18n()
  if (!request) return <Eyebrow className="mb-3">{fallback}</Eyebrow>
  return (
    <div className="mb-4 flex items-center gap-3">
      <ClientLogo client={request.client} size={40} />
      <Eyebrow>{t(template, { client: request.client.name })}</Eyebrow>
    </div>
  )
}
