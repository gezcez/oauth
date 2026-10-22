import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"
import { sessionQuery } from "@/api/queries"
import { AuthHeader } from "@/components/auth-header"
import { AuthLayout } from "@/components/auth-layout"
import { Button } from "@/components/ui/button"
import { env } from "@/env"
import { useI18n } from "@/i18n"

export const Route = createFileRoute("/")({
  validateSearch: z.object({ app: z.string().max(64).optional().catch(undefined) }),
  beforeLoad: async ({ context, search }) => {
    // The old UI was entered as /?app=dashboard; that entry now explains itself.
    if (search.app) return
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    throw redirect({ to: session ? "/account" : "/signin", replace: true })
  },
  component: OutdatedEntry,
})

function OutdatedEntry() {
  const { t } = useI18n()
  return (
    <AuthLayout>
      <AuthHeader
        eyebrow="gezcez"
        title={t("auth.error.outdated.title")}
        lead={t("auth.error.outdated.body")}
      />
      <Button asChild block>
        <a href={env.wwwUrl}>{t("common.goHome")}</a>
      </Button>
    </AuthLayout>
  )
}
