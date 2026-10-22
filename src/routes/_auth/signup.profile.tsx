import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { api, unwrap } from "@/api/client"
import type { Locale } from "@/api/schema"
import { AuthHeader } from "@/components/auth-header"
import { Avatar } from "@/components/brand/number-badge"
import { FormError } from "@/components/form-error"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { MissingFlow } from "@/features/email-code/missing-flow"
import { useAfterSignIn } from "@/features/session/after-signin"
import { env } from "@/env"
import { useI18n } from "@/i18n"
import { invalidateCsrfToken } from "@/lib/csrf"
import { toGezcezError } from "@/lib/errors"
import { secretStore } from "@/lib/flow-memory"
import { initialsOf, nameFromEmail } from "@/lib/mask"
import { authSearch } from "@/lib/search"
import { PRIVACY_VERSION, TOS_VERSION } from "@/lib/legal"

export const Route = createFileRoute("/_auth/signup/profile")({
  validateSearch: authSearch,
  component: ProfilePage,
})

function ProfilePage() {
  const { req, return: returnTo } = Route.useSearch()
  const { t } = useI18n()
  const pending = secretStore.get("profileToken")
  if (!pending)
    return <MissingFlow to="/signup" req={req} returnTo={returnTo} message={t("auth.profile.missingToken")} />
  return <ProfileForm token={pending.token} email={pending.email} req={req} returnTo={returnTo} />
}

function ProfileForm({
  token,
  email,
  req,
  returnTo,
}: {
  token: string
  email?: string | undefined
  req?: string | undefined
  returnTo?: string | undefined
}) {
  const { t, locale, setLocale } = useI18n()
  const navigate = useNavigate()
  const after = useAfterSignIn()
  const schema = z.object({
    display_name: z
      .string()
      .trim()
      .min(1, t("auth.profile.nameRequired"))
      .max(40, t("auth.profile.nameTooLong")),
    locale: z.enum(["tr", "en"]),
    terms: z.boolean().refine((v) => v, t("auth.profile.termsRequired")),
    news: z.boolean(),
  })
  type Values = z.infer<typeof schema>
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { display_name: email ? nameFromEmail(email) : "", locale, terms: false, news: false },
  })
  const name = form.watch("display_name")

  const complete = useMutation({
    mutationFn: async (v: Values) => {
      const res = await unwrap(
        api.POST("/v1/account/signup/complete", {
          body: {
            profile_token: token,
            display_name: v.display_name.trim(),
            tos_version: TOS_VERSION,
            privacy_version: PRIVACY_VERSION,
            locale: v.locale as Locale,
          },
        }),
      )
      invalidateCsrfToken()
      if (v.news) {
        // Optional opt-in; signup/complete has no field for it, so it is a second, best-effort call.
        await unwrap(api.PATCH("/v1/account/privacy", { body: { product_emails: true } })).catch(
          () => undefined,
        )
      }
      return res
    },
    onSuccess: async (_res, v) => {
      secretStore.take("profileToken")
      setLocale(v.locale as Locale)
      await after({ req, returnTo, welcome: true })
    },
    onError: (e) => {
      const err = toGezcezError(e)
      if (
        err.code === "AUTH_CODE_EXPIRED" ||
        err.code === "AUTH_TOKEN_EXPIRED" ||
        err.code === "AUTH_TOKEN_INVALID"
      ) {
        secretStore.take("profileToken")
        void navigate({ to: "/signup", search: { req, return: returnTo, expired: true }, replace: true })
      }
      if (err.code === "VALIDATION_FAILED")
        form.setError("display_name", { message: t("auth.profile.nameTooLong") })
    },
  })

  const termsError = form.formState.errors.terms?.message
  return (
    <>
      <AuthHeader
        eyebrow={t("auth.eyebrow.signup")}
        title={t("auth.profile.title")}
        lead={t("auth.profile.lead")}
      />
      <form noValidate onSubmit={form.handleSubmit((v) => complete.mutate(v))} className="space-y-6">
        <div className="flex items-end gap-4">
          <Avatar initials={initialsOf(name || "?")} className="size-14 text-lg" />
          <Field
            className="flex-1"
            label={t("auth.profile.nameLabel")}
            hint={t("auth.profile.nameHint")}
            error={form.formState.errors.display_name?.message}
          >
            <Input autoComplete="name" maxLength={60} autoFocus {...form.register("display_name")} />
          </Field>
        </div>

        <fieldset className="space-y-3">
          <legend className="mb-3 text-sm font-semibold">{t("auth.profile.languageLabel")}</legend>
          <Controller
            control={form.control}
            name="locale"
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={(v) => field.onChange(v)}
                className="grid-cols-2"
              >
                {(["tr", "en"] as const).map((l) => (
                  <label
                    key={l}
                    className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-4 ring-1 ring-line has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-primary"
                  >
                    <RadioGroupItem value={l} />
                    <span lang={l}>{l === "tr" ? t("common.turkish") : t("common.english")}</span>
                  </label>
                ))}
              </RadioGroup>
            )}
          />
        </fieldset>

        <div className="space-y-2">
          <Controller
            control={form.control}
            name="terms"
            render={({ field }) => (
              <div className="flex min-h-11 items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  aria-invalid={termsError ? true : undefined}
                  aria-describedby={termsError ? "terms-error" : undefined}
                  className="mt-1"
                />
                <label htmlFor="terms" className="-my-2 cursor-pointer py-2 text-sm">
                  {t("auth.profile.termsPrefix")}{" "}
                  <a
                    className="font-medium text-link underline underline-offset-4"
                    href={`${env.wwwUrl}/terms`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("auth.profile.termsLink")}
                  </a>{" "}
                  {t("auth.profile.termsMiddle")}{" "}
                  <a
                    className="font-medium text-link underline underline-offset-4"
                    href={`${env.wwwUrl}/privacy`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("auth.profile.privacyLink")}
                  </a>{" "}
                  {t("auth.profile.termsSuffix")}
                </label>
              </div>
            )}
          />
          {termsError ? (
            <p id="terms-error" className="text-sm text-danger">
              {termsError}
            </p>
          ) : null}
          <Controller
            control={form.control}
            name="news"
            render={({ field }) => (
              <div className="flex min-h-11 items-center gap-3">
                <Checkbox
                  id="news"
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                />
                <label htmlFor="news" className="-my-2 cursor-pointer py-2 text-sm">
                  {t("auth.profile.news")}
                </label>
              </div>
            )}
          />
        </div>

        {complete.error && toGezcezError(complete.error).code !== "VALIDATION_FAILED" ? (
          <FormError error={complete.error} />
        ) : null}
        <Button type="submit" block loading={complete.isPending}>
          {t("auth.profile.submit")}
        </Button>
      </form>
    </>
  )
}
