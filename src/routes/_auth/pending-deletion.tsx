import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { api, unwrap } from "@/api/client"
import { AuthHeader } from "@/components/auth-header"
import { FormError } from "@/components/form-error"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toaster"
import { useAfterSignIn } from "@/features/session/after-signin"
import { logout } from "@/features/session/api"
import { useI18n } from "@/i18n"
import { invalidateCsrfToken } from "@/lib/csrf"
import { secretStore } from "@/lib/flow-memory"
import { authSearch } from "@/lib/search"

/**
 * After proof of ownership the backend signs the user in and answers USER_PENDING_DELETION
 * (backend account.service signIn); "Keep my account" cancels with that session.
 */
export const Route = createFileRoute("/_auth/pending-deletion")({
  validateSearch: authSearch,
  component: PendingDeletionPage,
})

function PendingDeletionPage() {
  const { req, return: returnTo } = Route.useSearch()
  const { t, formatDate } = useI18n()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const after = useAfterSignIn()
  const details = secretStore.get("pendingDeletion")
  const deleteAt = typeof details?.delete_at === "string" ? details.delete_at : null
  const keep = useMutation({
    mutationFn: () => unwrap(api.POST("/v1/account/delete/cancel")),
    onSuccess: async () => {
      secretStore.take("pendingDeletion")
      toast(t("auth.pendingDeletion.kept"))
      await after({ req, returnTo })
    },
  })
  const signOut = useMutation({
    mutationFn: () => logout({ scope: "session" }),
    onSuccess: async () => {
      invalidateCsrfToken()
      await qc.invalidateQueries()
      void navigate({ to: "/signin", search: { req }, replace: true })
    },
  })
  return (
    <>
      <AuthHeader
        title={t("auth.pendingDeletion.title")}
        lead={
          deleteAt
            ? t("auth.pendingDeletion.lead", { date: formatDate(deleteAt) })
            : t("auth.pendingDeletion.leadNoDate")
        }
      />
      {keep.error || signOut.error ? (
        <FormError className="mb-4" error={keep.error ?? signOut.error} />
      ) : null}
      <div className="space-y-3">
        <Button block loading={keep.isPending} onClick={() => keep.mutate()}>
          {t("auth.pendingDeletion.keep")}
        </Button>
        <Button block variant="secondary" loading={signOut.isPending} onClick={() => signOut.mutate()}>
          {t("auth.pendingDeletion.signOut")}
        </Button>
      </div>
    </>
  )
}
