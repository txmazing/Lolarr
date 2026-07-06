import type { ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { XIcon } from 'lucide-react'
import { Button } from './Button'
import { useOverlayScope } from './OverlayScope'
import { cn } from '@ui/lib/utils'

export function GlassDialog({
  open,
  onClose,
  title,
  ariaLabel,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title?: string
  ariaLabel?: string
  children: ReactNode
  className?: string
}) {
  // On TV this is a Norigin focus boundary so the D-pad stays inside the open
  // dialog; on web it is a passthrough. See OverlayScope.
  const OverlayScope = useOverlayScope()
  return (
    // modal={false} + initialFocus={false}: Base UI darf weder einen Focus-Trap
    // setzen noch beim Öffnen den Fokus an sich ziehen. Sonst inertisiert es die
    // restliche Seite und desynchronisiert die Norigin-Spatial-Navigation auf dem
    // TV (D-Pad läuft ins Leere). So behält Norigin die Fokus-Hoheit; Escape und
    // Backdrop-Schließen bleiben erhalten.
    <Dialog.Root
      open={open}
      modal={false}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <Dialog.Portal>
        {/* Backdrop dimmt nur — der Blur kommt allein vom Glass-Popup. */}
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Popup
          aria-label={ariaLabel}
          initialFocus={false}
          className={cn(
            'glass fixed top-1/2 left-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border p-4 text-popover-foreground outline-none',
            'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            className,
          )}
        >
          {title ? <Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title> : null}
          <OverlayScope>{children}</OverlayScope>
          <Dialog.Close
            render={<Button aria-label="Schließen" variant="ghost" className="absolute top-2 right-2 h-10 w-10 p-0" />}
          >
            <XIcon className="size-4" />
          </Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
