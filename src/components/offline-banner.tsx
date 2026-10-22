import { WifiOff } from "lucide-react"
import { useI18n } from "@/i18n"
import { useOnline } from "@/lib/use-online"

export function OfflineBanner() {
  const online = useOnline()
  const { t } = useI18n()
  if (online) return null
  return (
    <div
      role="status"
      className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
    >
      <WifiOff className="size-4" aria-hidden />
      {t("common.offline")}
    </div>
  )
}
