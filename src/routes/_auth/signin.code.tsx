import { createFileRoute, Link } from "@tanstack/react-router"
import { AuthHeader } from "@/components/auth-header"
import { ClientEyebrow } from "@/features/authorize/client-eyebrow"
import { CodeForm } from "@/features/email-code/code-form"
import { MissingFlow } from "@/features/email-code/missing-flow"
import { useAuthRequest } from "@/features/session/use-auth-request"
import { useI18n } from "@/i18n"
import { flowStore } from "@/lib/flow-memory"
import { useVerifiedHandler } from "@/features/email-code/use-verified"
import { maskEmail } from "@/lib/mask"
import { codeSearch } from "@/lib/search"

export const Route = createFileRoute("/_auth/signin/code")({
  validateSearch: codeSearch,
  component: SignInCodePage,
})

function SignInCodePage() {
  const { req, return: returnTo, flow } = Route.useSearch()
  const { t } = useI18n()
  const request = useAuthRequest(req)
  const onVerified = useVerifiedHandler(req, returnTo)
  if (!flow) return <MissingFlow to="/signin" req={req} returnTo={returnTo} />
  const meta = flowStore.get(flow)
  const length = meta?.code_length ?? 6
  return (
    <>
      <ClientEyebrow
        request={request.data}
        fallback={meta?.intent === "signup" ? t("auth.eyebrow.signup") : t("auth.eyebrow.signin")}
      />
      <AuthHeader
        title={t("auth.code.title")}
        lead={
          meta?.email
            ? t("auth.code.lead", { length, email: maskEmail(meta.email) })
            : t("auth.code.leadNoEmail", { length })
        }
      />
      <CodeForm
        flowId={flow}
        req={req}
        codeLength={length}
        onVerified={onVerified}
        footer={
          <div className="space-y-3 border-t border-line pt-5 text-sm">
            <p>
              <Link
                to="/signin"
                search={{ req, return: returnTo }}
                className="font-medium text-link underline-offset-4 hover:underline"
              >
                {t("auth.code.differentEmail")}
              </Link>
            </p>
            <p>
              <Link
                to="/signin/password"
                search={{ req, return: returnTo }}
                className="font-medium text-link underline-offset-4 hover:underline"
              >
                {t("auth.signin.usePassword")}
              </Link>
            </p>
          </div>
        }
      />
    </>
  )
}
