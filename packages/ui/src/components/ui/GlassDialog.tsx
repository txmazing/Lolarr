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
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent
        aria-label={ariaLabel}
        className={cn('glass rounded-lg border-border max-w-lg', className)}
      >
        {title ? <DialogTitle className="text-xl font-semibold">{title}</DialogTitle> : null}
        {children}
      </DialogContent>
    </Dialog>
  )
}
