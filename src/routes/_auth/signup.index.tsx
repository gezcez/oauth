import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { z } from "zod"
import { AuthHeader } from "@/components/auth-header"
import { Alert } from "@/components/ui/alert"
import { ClientEyebrow } from "@/features/authorize/client-eyebrow"
import { EmailForm } from "@/features/email-code/email-form"
import { useAuthRequest } from "@/features/session/use-auth-request"
import { useI18n } from "@/i18n"
import { reqParam, returnParam } from "@/lib/search"

export const Route = createFileRoute("/_auth/signup/")({
  validateSearch: z.object({
    req: reqParam,
    return: returnParam,
    expired: z.boolean().optional().catch(undefined),
  }),
  component: SignUpPage,
})

function SignUpPage() {
  const { req, return: returnTo, expired } = Route.useSearch()
  const { t } = useI18n()
  const navigate = useNavigate()
  const request = useAuthRequest(req)
  return (
    <>
      <ClientEyebrow request={request.data} fallback={t("auth.eyebrow.signup")} />
      <AuthHeader title={t("auth.signup.title")} lead={t("auth.signup.lead")} />
      {expired ? <Alert className="mb-5">{t("auth.signup.expired")}</Alert> : null}
      <EmailForm
        intent="signup"
        req={req}
        onStarted={(flow) =>
          navigate({ to: "/signin/code", search: { req, return: returnTo, flow: flow.flow_id } })
        }
        footer={
          <p className="border-t border-line pt-5 text-sm">
            <Link
              to="/signin"
              search={{ req, return: returnTo }}
              className="font-medium text-link underline-offset-4 hover:underline"
            >
              {t("auth.signup.haveAccount")}
            </Link>
          </p>
        }
      />
    </>
  )
}
