import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { z } from "zod"
import { AuthHeader } from "@/components/auth-header"
import { FormError } from "@/components/form-error"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { logout } from "@/features/session/api"
import { useI18n } from "@/i18n"
import { invalidateCsrfToken } from "@/lib/csrf"
import { followRedirect } from "@/lib/navigation"

/**
 * RP-initiated logout (oauth.md 5.8). With client_id + post_logout_redirect_uri the backend ends
 * the session only if the URI is registered and returns redirect_to; otherwise nothing happened
 * and we ask the user ourselves, which blocks logout CSRF from random sites.
 */
export const Route = createFileRoute("/_auth/logout")({
  validateSearch: z.object({
    client_id: z.string().max(128).optional().catch(undefined),
    post_logout_redirect_uri: z.string().max(2048).optional().catch(undefined),
    state: z.string().max(512).optional().catch(undefined),
  }),
  component: LogoutPage,
})

function LogoutPage() {
  const search = Route.useSearch()
  const { t } = useI18n()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const router = useRouter()
  const hasClient = Boolean(search.client_id && search.post_logout_redirect_uri)
  const [mode, setMode] = useState<"auto" | "confirm">(hasClient ? "auto" : "confirm")
  const tried = useRef(false)

  const done = async () => {
    invalidateCsrfToken()
    qc.clear()
    await navigate({ to: "/signed-out", replace: true })
  }

  const auto = useMutation({
    mutationFn: () =>
      logout({
        scope: "session",
        client_id: search.client_id!,
        post_logout_redirect_uri: search.post_logout_redirect_uri!,
        ...(search.state ? { state: search.state } : {}),
      }),
    onSuccess: (res) => {
      if (res.redirect_to) {
        invalidateCsrfToken()
        followRedirect(res.redirect_to)
      } else setMode("confirm")
    },
    onError: () => setMode("confirm"),
  })

  const confirm = useMutation({
    mutationFn: (scope: "session" | "device") => logout({ scope }),
    onSuccess: done,
  })

  useEffect(() => {
    if (mode === "auto" && !tried.current) {
      tried.current = true
      auto.mutate()
    }
  }, [mode, auto])

  if (mode === "auto") {
    return (
      <div className="flex flex-col items-center gap-4 py-10" aria-busy="true">
        <Spinner className="size-8" />
        <p role="status" className="text-muted">
          {t("auth.logout.working")}
        </p>
      </div>
    )
  }

  return (
    <>
      <AuthHeader
        eyebrow={t("auth.eyebrow.signout")}
        title={t("auth.logout.title")}
        lead={t("auth.logout.lead")}
      />
      {confirm.error ? <FormError className="mb-4" error={confirm.error} /> : null}
      <div className="space-y-3">
        <Button
          block
          loading={confirm.isPending && confirm.variables === "session"}
          disabled={confirm.isPending}
          onClick={() => confirm.mutate("session")}
        >
          {t("auth.logout.confirm")}
        </Button>
        <Button
          block
          variant="secondary"
          loading={confirm.isPending && confirm.variables === "device"}
          disabled={confirm.isPending}
          onClick={() => confirm.mutate("device")}
        >
          {t("auth.logout.allAccounts")}
        </Button>
        <Button
          block
          variant="ghost"
          onClick={() =>
            window.history.length > 1 ? router.history.back() : void navigate({ to: "/account" })
          }
        >
          {t("auth.logout.cancel")}
        </Button>
      </div>
    </>
  )
}
