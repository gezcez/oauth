import { createFileRoute, Link } from "@tanstack/react-router"
import { z } from "zod"
import { AuthHeader } from "@/components/auth-header"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n"

export const Route = createFileRoute("/_auth/deletion-scheduled")({
  validateSearch: z.object({ at: z.iso.datetime().optional().catch(undefined) }),
  component: DeletionScheduledPage,
})

function DeletionScheduledPage() {
  const { at } = Route.useSearch()
  const { t, formatDate } = useI18n()
  return (
    <>
      <AuthHeader
        title={t("auth.deletionScheduled.title")}
        lead={
          at
            ? t("auth.deletionScheduled.lead", { date: formatDate(at) })
            : t("auth.deletionScheduled.leadNoDate")
        }
      />
      <div className="space-y-3">
        <Button asChild block variant="secondary">
          <Link to="/signin">{t("auth.signedOut.signinAgain")}</Link>
        </Button>
      </div>
    </>
  )
}
