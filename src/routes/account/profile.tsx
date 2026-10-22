import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { api, unwrap } from "@/api/client"
import { profileQuery, qk } from "@/api/queries"
import type { Profile } from "@/api/schema"
import { Avatar } from "@/components/brand/number-badge"
import { FormError } from "@/components/form-error"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toaster"
import { AccountPage, LoadError, Loading, Section } from "@/features/account/page"
import { useI18n } from "@/i18n"
import { isGezcezError } from "@/lib/errors"
import { initialsOf } from "@/lib/mask"
import { useHandleApiError } from "@/lib/use-api-error"

export const Route = createFileRoute("/account/profile")({
  component: ProfilePage,
})

function ProfilePage() {
  const { t } = useI18n()
  const profile = useQuery(profileQuery)
  if (profile.isPending) return <Loading />
  if (profile.error) return <LoadError error={profile.error} retry={() => void profile.refetch()} />
  return (
    <AccountPage title={t("account.profile.title")} lead={t("account.profile.lead")}>
      <ProfileForm profile={profile.data} />
    </AccountPage>
  )
}

function ProfileForm({ profile }: { profile: Profile }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const handle = useHandleApiError()
  const schema = z.object({
    display_name: z
      .string()
      .trim()
      .min(1, t("auth.profile.nameRequired"))
      .max(40, t("auth.profile.nameTooLong")),
  })
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { display_name: profile.display_name },
  })
  const name = form.watch("display_name")
  const save = useMutation({
    mutationFn: (v: z.infer<typeof schema>) =>
      unwrap(api.PATCH("/v1/account/profile", { body: { display_name: v.display_name.trim() } })),
    onSuccess: async (p) => {
      qc.setQueryData(qk.profile, p)
      await qc.invalidateQueries({ queryKey: qk.session })
      form.reset({ display_name: p.display_name })
      toast(t("account.profile.saved"))
    },
    onError: (e) => {
      if (isGezcezError(e) && e.code === "VALIDATION_FAILED")
        form.setError("display_name", { message: t("auth.profile.nameTooLong") })
      else handle(e)
    },
  })
  return (
    <Section>
      <form noValidate className="space-y-6" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
        <div className="flex items-center gap-4">
          <Avatar initials={initialsOf(name || profile.display_name)} className="size-16 text-xl" />
          <p className="text-sm text-muted">{t("account.profile.noPhotos")}</p>
        </div>
        <Field
          label={t("account.profile.nameLabel")}
          hint={t("auth.profile.nameHint")}
          error={form.formState.errors.display_name?.message}
        >
          <Input autoComplete="name" maxLength={60} {...form.register("display_name")} />
        </Field>
        {save.error && !isGezcezError(save.error) ? <FormError error={save.error} /> : null}
        {save.error && isGezcezError(save.error) && save.error.code !== "VALIDATION_FAILED" ? (
          <FormError error={save.error} />
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" loading={save.isPending}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Section>
  )
}
