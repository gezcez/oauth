import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { AuthHeader } from "@/components/auth-header"
import { ClientEyebrow } from "@/features/authorize/client-eyebrow"
import { EmailForm } from "@/features/email-code/email-form"
import { usePasskeySignIn } from "@/features/passkeys/signin"
import { PasskeySignIn } from "@/features/passkeys/signin-button"
import { useAuthRequest } from "@/features/session/use-auth-request"
import { useI18n } from "@/i18n"
import { authSearch } from "@/lib/search"

export const Route = createFileRoute("/_auth/signin/")({
  validateSearch: authSearch,
  component: SignInPage,
})

function SignInPage() {
  const { req, return: returnTo } = Route.useSearch()
  const { t } = useI18n()
  const navigate = useNavigate()
  const request = useAuthRequest(req)
  const passkey = usePasskeySignIn({ req, returnTo })
  return (
    <>
      <ClientEyebrow request={request.data} fallback={t("auth.eyebrow.signin")} />
      <AuthHeader title={t("auth.signin.title")} lead={t("auth.signin.lead")} />
      <EmailForm
        key={request.data?.login_hint ?? "none"}
        intent="signin"
        req={req}
        defaultEmail={request.data?.login_hint ?? undefined}
        autoComplete={passkey.supported ? "username webauthn" : "email"}
        onStarted={(flow) =>
          navigate({ to: "/signin/code", search: { req, return: returnTo, flow: flow.flow_id } })
        }
        footer={
          <>
            {passkey.supported ? (
              <PasskeySignIn pending={passkey.pending} problem={passkey.problem} onStart={passkey.start} />
            ) : null}
            <div className="space-y-3 border-t border-line pt-5 text-sm">
              <p>
                <Link
                  to="/signin/password"
                  search={{ req, return: returnTo }}
                  className="font-medium text-link underline-offset-4 hover:underline"
                >
                  {t("auth.signin.usePassword")}
                </Link>
              </p>
              <p>
                <Link
                  to="/signup"
                  search={{ req, return: returnTo }}
                  className="font-medium text-link underline-offset-4 hover:underline"
                >
                  {t("auth.signin.createAccount")}
                </Link>
              </p>
            </div>
          </>
        }
      />
    </>
  )
}
