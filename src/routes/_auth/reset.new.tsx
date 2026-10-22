import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { AuthHeader } from "@/components/auth-header"
import { FormError } from "@/components/form-error"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toaster"
import { MissingFlow } from "@/features/email-code/missing-flow"
import { passwordReset } from "@/features/password/api"
import { MAX_PASSWORD, MIN_PASSWORD, NewPasswordField } from "@/features/password/new-password-field"
import { useAfterSignIn } from "@/features/session/after-signin"
import { useI18n } from "@/i18n"
import { toGezcezError } from "@/lib/errors"
import { secretStore } from "@/lib/flow-memory"
import { useErrorMessage } from "@/lib/use-api-error"
import { authSearch } from "@/lib/search"

export const Route = createFileRoute("/_auth/reset/new")({
  validateSearch: authSearch,
  component: NewPasswordPage,
})

function NewPasswordPage() {
  const { req } = Route.useSearch()
  const { t } = useI18n()
  const pending = secretStore.get("resetToken")
  if (!pending) return <MissingFlow to="/reset" req={req} message={t("auth.reset.missingToken")} />
  return <NewPasswordForm token={pending.token} req={req} />
}

function NewPasswordForm({ token, req }: { token: string; req?: string | undefined }) {
  const { t } = useI18n()
  const message = useErrorMessage()
  const after = useAfterSignIn()
  const schema = z.object({
    password: z
      .string()
      .min(MIN_PASSWORD, t("auth.password.tooShort"))
      .max(MAX_PASSWORD, t("auth.password.tooLong")),
  })
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "" },
  })
  const value = form.watch("password")
  const m = useMutation({
    mutationFn: (pw: string) => passwordReset({ reset_token: token, new_password: pw }),
    onSuccess: async () => {
      secretStore.take("resetToken")
      toast(t("auth.reset.done"))
      await after({ req, returnTo: "/account/security" })
    },
    onError: (e) => {
      const err = toGezcezError(e)
      if (err.code === "AUTH_PASSWORD_WEAK" || err.code === "AUTH_PASSWORD_BREACHED") {
        form.setError("password", { message: message(err) })
      }
    },
  })
  const err = m.error ? toGezcezError(m.error) : null
  const fieldLevel = err && (err.code === "AUTH_PASSWORD_WEAK" || err.code === "AUTH_PASSWORD_BREACHED")
  return (
    <>
      <AuthHeader
        eyebrow={t("auth.eyebrow.reset")}
        title={t("auth.reset.newTitle")}
        lead={t("auth.reset.newLead")}
      />
      <form noValidate className="space-y-5" onSubmit={form.handleSubmit((v) => m.mutate(v.password))}>
        <NewPasswordField
          value={value}
          error={form.formState.errors.password?.message}
          autoFocus
          {...form.register("password")}
        />
        {err && !fieldLevel ? <FormError error={err} /> : null}
        <Button type="submit" block loading={m.isPending}>
          {t("auth.reset.submit")}
        </Button>
        <p className="text-sm text-subtle">{t("auth.password.strength.advisory")}</p>
      </form>
    </>
  )
}
