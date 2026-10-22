import { en } from "./en"
import { tr } from "./tr"
import type { Catalog, Locale, PluralKey, TKey, Vars } from "./types"

export const catalogs: Record<Locale, Catalog> = { en, tr }

/** Walks dotted paths; keys that themselves contain dots (event types) are matched greedily. */
export function lookup(obj: unknown, path: string): string | undefined {
  if (obj == null || typeof obj !== "object") return undefined
  const rec = obj as Record<string, unknown>
  if (path in rec) {
    const v = rec[path]
    return typeof v === "string" ? v : undefined
  }
  let i = path.indexOf(".")
  while (i !== -1) {
    const head = path.slice(0, i)
    if (head in rec) {
      const found = lookup(rec[head], path.slice(i + 1))
      if (found !== undefined) return found
    }
    i = path.indexOf(".", i + 1)
  }
  return undefined
}

export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m))
}

export function translate(locale: Locale, key: TKey | (string & {}), vars?: Vars): string {
  const value = lookup(catalogs[locale], key) ?? lookup(catalogs.en, key)
  if (value === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] missing key ${key}`)
    return key
  }
  return interpolate(value, vars)
}

export function translatePlural(locale: Locale, key: PluralKey, count: number, vars?: Vars): string {
  const rule = new Intl.PluralRules(locale).select(count)
  const form = rule === "one" ? "one" : "other"
  return translate(locale, `${key}_${form}`, { count, ...vars })
}
