import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { AuthHeader } from "@/components/auth-header"
import { EmailForm } from "@/features/email-code/email-form"
import { useI18n } from "@/i18n"
import { authSearch } from "@/lib/search"

export const Route = createFileRoute("/_auth/reset/")({
  validateSearch: authSearch,
  component: ResetPage,
})

function ResetPage() {
  const { req } = Route.useSearch()
  const { t } = useI18n()
  const navigate = useNavigate()
  return (
    <>
      <AuthHeader
        eyebrow={t("auth.eyebrow.reset")}
        title={t("auth.reset.title")}
        lead={t("auth.reset.lead")}
      />
      <EmailForm
        intent="reset"
        req={req}
        onStarted={(flow) => navigate({ to: "/reset/code", search: { req, flow: flow.flow_id } })}
        footer={
          <p className="border-t border-line pt-5 text-sm">
            <Link
              to="/signin"
              search={{ req }}
              className="font-medium text-link underline-offset-4 hover:underline"
            >
              {t("auth.reset.backToSignin")}
            </Link>
          </p>
        }
      />
    </>
  )
}
