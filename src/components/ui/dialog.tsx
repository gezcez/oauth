import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import type { ReactNode } from "react"
import { useI18n } from "@/i18n"
import { cn } from "@/lib/cn"

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export function DialogContent({
  title,
  description,
  children,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const { t } = useI18n()
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-navy/40 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl bg-background p-6 text-foreground ring-1 ring-line sm:inset-x-0 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2",
          className,
        )}
      >
        <div className="pr-8">
          <DialogPrimitive.Title className="text-xl font-bold tracking-tight">{title}</DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-2 text-muted">
              {description}
            </DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          )}
        </div>
        {children ? <div className="mt-6">{children}</div> : null}
        <DialogPrimitive.Close
          className="absolute top-4 right-4 inline-flex size-11 items-center justify-center rounded-full text-muted hover:bg-secondary-hover focus-visible:outline-2 focus-visible:outline-focus"
          aria-label={t("common.close")}
        >
          <X className="size-5" aria-hidden />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{children}</div>
}
