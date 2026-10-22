import { forwardRef, useState, type ClipboardEvent } from "react"
import { cn } from "@/lib/cn"

/**
 * Six boxes drawn under one real, transparent input: autocomplete="one-time-code", inputmode numeric,
 * so paste and iOS/Android code autofill go straight into the input. Calls onComplete when the last
 * digit lands. Own implementation (no library) because the CSP forbids injected <style> elements.
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
>(function OtpInput({ length = 6, invalid, shake, value, onChange, onComplete, disabled, ...rest }, ref) {
  const [focused, setFocused] = useState(false)

  function set(raw: string) {
    const next = raw.replace(/\D/g, "").slice(0, length)
    if (next === value) return
    onChange(next)
    if (next.length === length && value.length < length) onComplete?.(next)
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    set(e.clipboardData.getData("text/plain"))
  }

  const active = Math.min(value.length, length - 1)
  return (
    <div className={cn("relative w-full", disabled && "opacity-60", shake && "motion-safe:animate-shake")}>
      <div className="flex w-full justify-between gap-1.5 sm:gap-2" aria-hidden>
        {Array.from({ length }, (_, i) => {
          const char = value[i]
          const isActive = focused && i === active
          return (
            <div
              key={i}
              className={cn(
                "relative flex h-14 w-11 items-center justify-center rounded-xl border bg-input text-2xl font-semibold tabular-nums transition-colors sm:w-12",
                invalid ? "border-danger" : "border-line-strong",
                isActive && "border-foreground ring-2 ring-focus",
              )}
            >
              {char}
              {isActive && char === undefined ? (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="h-7 w-px animate-pulse bg-foreground" />
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={length}
        spellCheck={false}
        value={value}
        disabled={disabled}
        onChange={(e) => set(e.target.value)}
        onPaste={onPaste}
        onFocus={(e) => {
          setFocused(true)
          const end = e.currentTarget.value.length
          e.currentTarget.setSelectionRange(end, end)
        }}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent disabled:cursor-default"
        {...rest}
      />
    </div>
  )
})
