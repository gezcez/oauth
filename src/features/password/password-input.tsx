import { Eye, EyeOff } from "lucide-react"
import { forwardRef, useState, type InputHTMLAttributes } from "react"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/i18n"

/** Password field with a show/hide toggle (the reset form uses this instead of a confirm field). */
export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput(props, ref) {
    const { t } = useI18n()
    const [visible, setVisible] = useState(false)
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          spellCheck={false}
          autoCapitalize="none"
          className="pr-14"
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("common.hidePassword") : t("common.showPassword")}
          aria-pressed={visible}
          className="absolute inset-y-0 right-1 my-auto inline-flex size-11 items-center justify-center rounded-full text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
        >
          {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </div>
    )
  },
)
