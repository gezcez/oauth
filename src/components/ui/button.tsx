import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { forwardRef, type ButtonHTMLAttributes } from "react"
import { cn } from "@/lib/cn"
import { Spinner } from "./spinner"

/** Pill buttons as on www: primary navy (amber in dark), secondary outline, tertiary text link. */
export const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors select-none disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
  {
    variants: {
      variant: {
        primary: "rounded-full bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary:
          "rounded-full border border-line-strong bg-secondary text-foreground hover:bg-secondary-hover",
        destructive: "rounded-full border border-danger text-danger bg-transparent hover:bg-danger-bg",
        ghost: "rounded-full text-foreground hover:bg-secondary-hover",
        link: "rounded-md px-0 h-auto font-medium text-link underline-offset-4 hover:underline",
      },
      size: {
        lg: "h-12 px-6 text-base",
        md: "h-11 px-5 text-sm",
        sm: "h-9 px-4 text-sm",
        icon: "size-11",
        inline: "",
      },
      block: { true: "w-full", false: "" },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "lg", block: false },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, asChild, loading, children, disabled, type, ...props },
  ref,
) {
  const sz = variant === "link" ? (size ?? "inline") : size
  if (asChild) {
    return (
      <Slot ref={ref} className={cn(buttonVariants({ variant, size: sz, block }), className)} {...props}>
        {children}
      </Slot>
    )
  }
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cn(buttonVariants({ variant, size: sz, block }), className)}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      {...props}
      onClick={loading ? (e) => e.preventDefault() : props.onClick}
    >
      {loading ? (
        <>
          <span className="invisible inline-flex items-center gap-2">{children}</span>
          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner />
          </span>
        </>
      ) : (
        children
      )}
    </button>
  )
})
