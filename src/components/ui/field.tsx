import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react"
import { cn } from "@/lib/cn"
import { Label } from "./label"

/**
 * Visible label above, hint and error below, wired with aria-describedby and aria-invalid.
 * The child must be a single input-like element.
 */
export function Field({
  label,
  hint,
  error,
  children,
  className,
  id: idProp,
  labelAside,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  children: ReactElement<Record<string, unknown>>
  className?: string
  id?: string
  labelAside?: ReactNode
}) {
  const auto = useId()
  const id = idProp ?? `f${auto.replace(/:/g, "")}`
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })
    : children
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {labelAside}
      </div>
      {control}
      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-sm text-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
