import * as Menu from "@radix-ui/react-dropdown-menu"
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react"
import { cn } from "@/lib/cn"

export const DropdownMenu = Menu.Root
export const DropdownMenuTrigger = Menu.Trigger

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof Menu.Content>,
  ComponentPropsWithoutRef<typeof Menu.Content>
>(function DropdownMenuContent({ className, sideOffset = 8, ...props }, ref) {
  return (
    <Menu.Portal>
      <Menu.Content
        ref={ref}
        sideOffset={sideOffset}
        align="end"
        className={cn(
          "z-50 min-w-64 rounded-2xl bg-background p-2 text-foreground ring-1 ring-line-strong",
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  )
})

export const DropdownMenuItem = forwardRef<
  ElementRef<typeof Menu.Item>,
  ComponentPropsWithoutRef<typeof Menu.Item>
>(function DropdownMenuItem({ className, ...props }, ref) {
  return (
    <Menu.Item
      ref={ref}
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium outline-none select-none data-[highlighted]:bg-secondary-hover data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    />
  )
})

export const DropdownMenuLabel = Menu.Label
export function DropdownMenuSeparator() {
  return <Menu.Separator className="my-1 h-px bg-line" />
}
