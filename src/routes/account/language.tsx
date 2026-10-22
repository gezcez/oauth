import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { api, unwrap } from "@/api/client"
import { qk } from "@/api/queries"
import type { Locale } from "@/api/schema"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "@/components/ui/toaster"
import { AccountPage, Section } from "@/features/account/page"
import { useI18n } from "@/i18n"
import { useHandleApiError } from "@/lib/use-api-error"

export const Route = createFileRoute("/account/language")({
  component: LanguagePage,
})

function LanguagePage() {
  const { t, locale, setLocale } = useI18n()
  const qc = useQueryClient()
  const handle = useHandleApiError()
  const save = useMutation({
    mutationFn: (l: Locale) => unwrap(api.PATCH("/v1/account/profile", { body: { locale: l } })),
    onMutate: (l) => {
      const prev = locale
      setLocale(l)
      return { prev }
    },
    onSuccess: async (p) => {
      qc.setQueryData(qk.profile, p)
      await qc.invalidateQueries({ queryKey: qk.session })
      toast(t("account.language.saved"))
    },
    onError: (e, _l, ctx) => {
      if (ctx) setLocale(ctx.prev)
      handle(e, { toastInline: true })
    },
  })
  return (
    <AccountPage title={t("account.language.title")} lead={t("account.language.lead")}>
      <Section>
        <RadioGroup
          value={locale}
          onValueChange={(v) => save.mutate(v as Locale)}
          aria-label={t("account.language.title")}
          disabled={save.isPending}
        >
          {(["tr", "en"] as const).map((l) => (
            <label
              key={l}
              className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-4 ring-1 ring-line has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-primary"
            >
              <RadioGroupItem value={l} />
              <span lang={l} className="font-medium">
                {l === "tr" ? "Türkçe" : "English"}
              </span>
            </label>
          ))}
        </RadioGroup>
      </Section>
    </AccountPage>
  )
}
