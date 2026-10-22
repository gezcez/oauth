import { Check } from "lucide-react"
import type { ScopeInfo } from "@/api/schema"
import { useI18n } from "@/i18n"
import type { TKey } from "@/i18n/types"
import { catalogs, lookup } from "@/i18n/translate"

/** Scope keys in plain words. Unknown scopes are shown by key rather than hidden. */
export function scopeLabel(
  t: (k: TKey, v?: Record<string, string>) => string,
  locale: "tr" | "en",
  s: ScopeInfo,
): string {
  const key = s.i18n_key?.startsWith("scopes.") ? s.i18n_key : `scopes.${s.key}`
  return lookup(catalogs[locale], key) ?? t("scopes.unknown", { scope: s.key })
}

export function ScopeList({ scopes }: { scopes: ScopeInfo[] }) {
  const { t, locale } = useI18n()
  return (
    <ul className="space-y-3">
      {scopes.map((s) => (
        <li key={s.key} className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-success-bg text-success">
            <Check className="size-4" strokeWidth={3} aria-hidden />
          </span>
          <span>{scopeLabel(t, locale, s)}</span>
        </li>
      ))}
    </ul>
  )
}
