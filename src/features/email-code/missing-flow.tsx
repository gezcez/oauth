import { Link } from "@tanstack/react-router"
import { AuthHeader } from "@/components/auth-header"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n"

/** Reached a code or token step without its flow (reload, old tab): explain and restart. */
export function MissingFlow({
  to,
  req,
  returnTo,
  message,
}: {
  to: "/signin" | "/signup" | "/reset"
  req?: string | undefined
  returnTo?: string | undefined
  message?: string
}) {
  const { t } = useI18n()
  return (
    <>
      <AuthHeader title={t("auth.code.startAgain")} lead={message ?? t("auth.code.missingFlow")} />
      <Button asChild block>
        <Link to={to} search={{ req, return: returnTo }}>
          {t("auth.code.startAgain")}
        </Link>
      </Button>
    </>
  )
}
