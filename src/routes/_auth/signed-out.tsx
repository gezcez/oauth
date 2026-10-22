import { createFileRoute, Link } from "@tanstack/react-router"
import { LogOut } from "lucide-react"
import { AuthHeader } from "@/components/auth-header"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n"

export const Route = createFileRoute("/_auth/signed-out")({
  component: SignedOutPage,
})

function SignedOutPage() {
  const { t } = useI18n()
  return (
    <>
      <AuthHeader
        icon={
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-info-bg">
            <LogOut className="size-5" aria-hidden />
          </span>
        }
        title={t("auth.signedOut.title")}
        lead={t("auth.signedOut.lead")}
      />
      <Button asChild block>
        <Link to="/signin">{t("auth.signedOut.signinAgain")}</Link>
      </Button>
    </>
  )
}
