import type { ComponentProps } from 'react'
import { cn } from '@ui/lib/utils'

export type BadgeVariant = 'default' | 'outline'

// A small monochrome status pill. `outline` is a hairline chip used by the
// status badges (they layer in their own semantic colour classes); `default`
// is the solid near-white accent chip.
export function Badge({
  variant = 'default',
  className,
  ...props
}: ComponentProps<'span'> & { variant?: BadgeVariant }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        'inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        variant === 'default'
          ? 'border-transparent bg-primary text-primary-foreground'
          : 'border-border text-foreground',
        className,
      )}
      {...props}
    />
  )
}
