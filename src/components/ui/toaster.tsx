import { Toaster as Sonner } from "sonner"

export { toast } from "sonner"

/** Flat toasts in brand colours (no shadow). */
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      closeButton
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-start gap-3 rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground ring-1 ring-line",
          error: "!bg-[#7f1d1d] !text-white",
          description: "text-xs opacity-80",
          closeButton: "!static order-last !bg-transparent !border-0 !text-current",
        },
      }}
    />
  )
}
