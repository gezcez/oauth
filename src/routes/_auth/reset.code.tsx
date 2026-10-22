import { createFileRoute, Link } from "@tanstack/react-router"
import { AuthHeader } from "@/components/auth-header"
import { CodeForm } from "@/features/email-code/code-form"
import { MissingFlow } from "@/features/email-code/missing-flow"
import { useVerifiedHandler } from "@/features/email-code/use-verified"
import { useI18n } from "@/i18n"
import { flowStore } from "@/lib/flow-memory"
import { maskEmail } from "@/lib/mask"
import { codeSearch } from "@/lib/search"

export const Route = createFileRoute("/_auth/reset/code")({
  validateSearch: codeSearch,
  component: ResetCodePage,
})

function ResetCodePage() {
  const { req, flow } = Route.useSearch()
  const { t } = useI18n()
  const onVerified = useVerifiedHandler(req, "/account/security")
  if (!flow) return <MissingFlow to="/reset" req={req} />
  const meta = flowStore.get(flow)
  const length = meta?.code_length ?? 6
  return (
    <>
      <AuthHeader
        eyebrow={t("auth.eyebrow.reset")}
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
          <p className="border-t border-line pt-5 text-sm">
            <Link
              to="/reset"
              search={{ req }}
              className="inline-flex min-h-11 items-center font-medium text-link underline-offset-4 hover:underline"
            >
              {t("auth.code.differentEmail")}
            </Link>
          </p>
        }
      />
    </>
  )
}
