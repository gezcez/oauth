import * as SwitchPrimitive from "@radix-ui/react-switch"
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react"
import { cn } from "@/lib/cn"

export const Switch = forwardRef<
  ElementRef<typeof SwitchPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        "inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-input-border bg-line p-0.5 transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-5.5 rounded-full bg-white ring-1 ring-black/5 transition-transform data-[state=checked]:translate-x-5 data-[state=checked]:bg-primary-foreground" />
    </SwitchPrimitive.Root>
  )
})
