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

// Purely presentational and non-interactive: removal is timer-driven by the
// ToastProvider. No Norigin focusable is registered, so the TV remote never
// lands on a toast.
export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) {
    return null
  }
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.kind}`}>
          {MESSAGE[toast.kind](toast.title)}
        </div>
      ))}
    </div>
  )
}
