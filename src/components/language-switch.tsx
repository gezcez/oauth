import { useI18n, type Locale } from "@/i18n"
import { cn } from "@/lib/cn"

/** TR / EN pill toggle (top right of the auth layout). */
export function LanguageSwitch({ onChange }: { onChange?: (l: Locale) => void }) {
  const { locale, setLocale, t } = useI18n()
  const options: { value: Locale; label: string; full: string }[] = [
    { value: "tr", label: "TR", full: t("common.turkish") },
    { value: "en", label: "EN", full: t("common.english") },
  ]
  return (
    <div
      role="group"
      aria-label={t("common.languageSwitch")}
      className="inline-flex rounded-full bg-surface p-1 ring-1 ring-line"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          lang={o.value}
          aria-pressed={locale === o.value}
          aria-label={o.full}
          onClick={() => {
            setLocale(o.value)
            onChange?.(o.value)
          }}
          className={cn(
            "inline-flex h-9 min-w-11 items-center justify-center rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-focus",
            locale === o.value ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
