import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@ui/components/ui/shadcn/dialog'
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
  return (
    // modal={false} + initialFocus={false}: Base UI darf weder einen Focus-Trap
    // setzen noch beim Öffnen den Fokus an sich ziehen. Sonst inertisiert es die
    // restliche Seite und desynchronisiert die Norigin-Spatial-Navigation auf dem
    // TV (D-Pad läuft ins Leere). So behält Norigin die Fokus-Hoheit; Escape und
    // Backdrop-Schließen bleiben erhalten.
    <Dialog open={open} modal={false} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent
        aria-label={ariaLabel}
        initialFocus={false}
        className={cn('glass rounded-lg border-border max-w-lg', className)}
      >
        {title ? <DialogTitle className="text-xl font-semibold">{title}</DialogTitle> : null}
        {children}
      </DialogContent>
    </Dialog>
  )
}
