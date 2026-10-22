import { OTPInput, type SlotProps } from "input-otp"
import { forwardRef } from "react"
import { cn } from "@/lib/cn"

/**
 * Six boxes over one real input: autocomplete="one-time-code", inputmode numeric, paste and
 * iOS/Android autofill supported by input-otp. Calls onComplete on the last digit.
 */
export const OtpInput = forwardRef<
  HTMLInputElement,
  {
    id?: string
    value: string
    onChange: (v: string) => void
    onComplete?: (v: string) => void
    length?: number
    disabled?: boolean
    invalid?: boolean
    shake?: boolean
    "aria-describedby"?: string
    "aria-invalid"?: boolean
    "aria-label"?: string
    autoFocus?: boolean
  }
>(function OtpInput({ length = 6, invalid, shake, value, onChange, onComplete, ...rest }, ref) {
  return (
    <OTPInput
      ref={ref}
      maxLength={length}
      value={value}
      onChange={(v) => onChange(v.replace(/\D/g, ""))}
      onComplete={onComplete}
      inputMode="numeric"
      pattern="^[0-9]*$"
      autoComplete="one-time-code"
      pushPasswordManagerStrategy="none"
      containerClassName={cn(
        "flex items-center gap-2 has-[:disabled]:opacity-60",
        shake && "motion-safe:animate-shake",
      )}
      render={({ slots }) => (
        <div className="flex w-full justify-between gap-1.5 sm:gap-2">
          {slots.map((slot, i) => (
            <Slot key={i} {...slot} invalid={invalid} />
          ))}
        </div>
      )}
      {...rest}
    />
  )
})

function Slot({ char, isActive, hasFakeCaret, invalid }: SlotProps & { invalid?: boolean | undefined }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative flex h-14 w-11 items-center justify-center rounded-xl border bg-input text-2xl font-semibold tabular-nums transition-colors sm:w-12",
        invalid ? "border-danger" : "border-line-strong",
        isActive && "border-foreground ring-2 ring-focus",
      )}
    >
      {char}
      {hasFakeCaret ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="h-7 w-px animate-pulse bg-foreground" />
        </span>
      ) : null}
    </div>
  )
}
