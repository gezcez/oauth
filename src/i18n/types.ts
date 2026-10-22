import type { en } from "./en"

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> }

/** Shape every locale must fill. English is the source. */
export type Catalog = Widen<typeof en>

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>
}[keyof T & string]

/** Every translatable key, for example "auth.signin.title" or "errors.RATE_LIMITED". */
export type TKey = Leaves<Catalog>

/** Keys that have `_one` / `_other` plural forms, without the suffix. */
export type PluralKey = TKey extends infer K ? (K extends `${infer B}_other` ? B : never) : never

export type Locale = "tr" | "en"
export const LOCALES: readonly Locale[] = ["tr", "en"] as const

export type Vars = Record<string, string | number>
