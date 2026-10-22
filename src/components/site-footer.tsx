import { env } from "@/env"
import { useI18n } from "@/i18n"

export function SiteFooter() {
  const { t, locale } = useI18n()
  const www = env.wwwUrl
  const links = [
    { href: `${www}/privacy`, label: t("common.privacy") },
    { href: `${www}/terms`, label: t("common.terms") },
    { href: `mailto:${env.supportEmail}`, label: t("common.help") },
  ]
  return (
    <footer
      className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 pb-8 text-sm text-subtle"
      lang={locale}
    >
      {links.map((l) => (
        <a key={l.href} href={l.href} className="inline-flex min-h-11 items-center hover:text-foreground">
          {l.label}
        </a>
      ))}
      <span>{t("common.copyright", { year: new Date().getFullYear() })}</span>
    </footer>
  )
}
