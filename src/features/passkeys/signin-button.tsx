import { Fingerprint } from "lucide-react"
import { FormError } from "@/components/form-error"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n"
import type { TKey } from "@/i18n/types"
import type { PasskeySignInProblem } from "./signin"

const CEREMONY_COPY = {
  cancelled: "auth.passkey.cancelled",
  exists: "auth.passkey.failed",
  unsupported: "auth.passkey.unsupported",
  failed: "auth.passkey.failed",
} as const satisfies Record<string, TKey>

/** "or" divider, the passkey button and what went wrong with the last try. */
export function PasskeySignIn({
  pending,
  problem,
  onStart,
}: {
  pending: boolean
  problem: PasskeySignInProblem | null
  onStart: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm text-subtle" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        {t("auth.passkey.or")}
        <span className="h-px flex-1 bg-line" />
      </div>
      <Button variant="secondary" block loading={pending} onClick={onStart}>
        <Fingerprint className="size-5" aria-hidden />
        {t("auth.passkey.button")}
      </Button>
      {problem?.kind === "ceremony" ? (
        <Alert tone={problem.failure === "cancelled" ? "info" : "error"}>
          {t(CEREMONY_COPY[problem.failure])}
        </Alert>
      ) : problem?.kind === "unknown" ? (
        <Alert tone="error">{t("auth.passkey.unknown")}</Alert>
      ) : problem?.kind === "api" ? (
        <FormError error={problem.error} />
      ) : null}
    </div>
  )
}
