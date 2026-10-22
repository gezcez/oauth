import { Link } from "@tanstack/react-router"
import { useI18n } from "@/i18n"
import { Eyebrow } from "./brand/eyebrow"
import { Lead, PageHeading } from "./brand/page-heading"
import { AuthLayout } from "./auth-layout"
import { Button } from "./ui/button"

export function NotFoundPage() {
  const { t } = useI18n()
  return (
    <AuthLayout>
      <div className="space-y-4">
        <Eyebrow>404</Eyebrow>
        <PageHeading>{t("common.notFound.title")}</PageHeading>
        <Lead>{t("common.notFound.body")}</Lead>
        <Button asChild block>
          <Link to="/account">{t("common.notFound.cta")}</Link>
        </Button>
      </div>
    </AuthLayout>
  )
}
