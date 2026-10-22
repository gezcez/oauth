import type { ErrorComponentProps } from "@tanstack/react-router"
import { RotateCw } from "lucide-react"
import { useI18n } from "@/i18n"
import { toGezcezError } from "@/lib/errors"
import { reloadPage } from "@/lib/navigation"
import { Eyebrow } from "./brand/eyebrow"
import { PageHeading, Lead } from "./brand/page-heading"
import { AuthLayout } from "./auth-layout"
import { Button } from "./ui/button"

/** Error boundary: same copy as a 5xx, with Reload and the support reference. */
export function ErrorPage({ error }: Partial<ErrorComponentProps>) {
  const { t } = useI18n()
  const err = toGezcezError(error)
  return (
    <AuthLayout>
      <div className="space-y-4">
        <Eyebrow>gezcez</Eyebrow>
        <PageHeading>{t("common.crash.title")}</PageHeading>
        <Lead>{t("common.crash.body")}</Lead>
        {err.reference ? (
          <p className="text-sm text-subtle">
            {t("common.reference")}: <code className="font-mono">{err.reference}</code>
          </p>
        ) : null}
        <Button block onClick={reloadPage}>
          <RotateCw className="size-4" aria-hidden />
          {t("common.reload")}
        </Button>
      </div>
    </AuthLayout>
  )
}
