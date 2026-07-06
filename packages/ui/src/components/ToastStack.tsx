import { cn } from '@ui/lib/utils'

export type ToastKind = 'available' | 'approved' | 'declined' | 'failed' | 'requested'

export type ToastItem = {
  id: string
  kind: ToastKind
  title: string
}

const MESSAGE: Record<ToastKind, (title: string) => string> = {
  available: (title) => `${title} is now available`,
  approved: (title) => `${title} was approved`,
  declined: (title) => `${title} was declined`,
  failed: (title) => `${title} failed to process`,
  requested: (title) => `${title} was requested`,
}

const TOAST_BORDER: Record<ToastKind, string> = {
  available: 'border-l-status-available',
  approved: 'border-l-status-processing',
  declined: 'border-l-status-declined',
  failed: 'border-l-status-failed',
  requested: 'border-l-status-requested',
}

// Purely presentational and non-interactive: removal is timer-driven by the
// ToastProvider. No Norigin focusable is registered, so the TV remote never
// lands on a toast.
export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) {
    return null
  }
  return (
    <div
      className="pointer-events-none fixed top-6 right-6 z-[1000] flex max-w-[min(90vw,22rem)] flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'rounded-md glass border-l-4 px-4 py-3 text-sm text-foreground shadow-[0_6px_20px_rgba(0,0,0,0.4)]',
            TOAST_BORDER[toast.kind],
          )}
        >
          {MESSAGE[toast.kind](toast.title)}
        </div>
      ))}
    </div>
  )
}
