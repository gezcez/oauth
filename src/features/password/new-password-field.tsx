import { forwardRef, type InputHTMLAttributes } from "react"
import { Field } from "@/components/ui/field"
import { useI18n } from "@/i18n"
import { cn } from "@/lib/cn"
import { PasswordInput } from "./password-input"
import { passwordStrength } from "./strength"

export const MIN_PASSWORD = 10
export const MAX_PASSWORD = 128

export const NewPasswordField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { value: string; error?: string | undefined; label?: string }
>(function NewPasswordField({ value, error, label, ...rest }, ref) {
  const { t } = useI18n()
  const s = passwordStrength(value)
  const labels = [
    t("auth.password.strength.weak"),
    t("auth.password.strength.ok"),
    t("auth.password.strength.strong"),
  ]
  return (
    <div className="space-y-2">
      <Field label={label ?? t("auth.password.newLabel")} hint={t("auth.password.newHint")} error={error}>
        <PasswordInput ref={ref} autoComplete="new-password" {...rest} />
      </Field>
      {value ? (
        <div className="flex items-center gap-3 text-xs text-subtle" aria-live="polite">
          <div className="flex flex-1 gap-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  i <= s
                    ? s === 0
                      ? "bg-danger"
                      : s === 1
                        ? "bg-brand-amber-500"
                        : "bg-success"
                    : "bg-line",
                )}
              />
            ))}
          </div>
          <span>
            {t("auth.password.strength.label")}: {labels[s]}
          </span>
        </div>
      ) : null}
    </div>
  )
})
