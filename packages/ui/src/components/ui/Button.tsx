import type { ComponentProps } from 'react'
import { Button as BaseButton } from '@base-ui/react/button'
import { cn } from '@ui/lib/utils'

export type LolarrButtonVariant = 'primary' | 'secondary' | 'ghost' | 'glass' | 'card'
export type LolarrButtonSize = 'md' | 'lg'

const BASE =
  'group inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent text-sm font-medium whitespace-nowrap outline-none select-none transition-[transform,background-color,border-color,color] duration-[350ms] ease-out-expo focus-visible:ring-3 focus-visible:ring-ring/50 focused:scale-[1.06] focused:border-ring focused:bg-surface-3 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4'

// Standard control height (44px) — matches Input so buttons and fields line up.
const SIZES: Record<LolarrButtonSize, string> = {
  md: 'h-11 px-4',
  lg: 'h-12 px-5',
}

const VARIANTS: Record<LolarrButtonVariant, string> = {
  // Solid near-white fill + near-black text — the single strong CTA per screen.
  primary: 'bg-primary text-primary-foreground hover:bg-primary/80',
  // The workhorse: a solid dark chip that inverts to the near-white accent with
  // near-black text on hover/focus (the reference theme's signature button move).
  secondary:
    'bg-surface-chip text-foreground hover:bg-foreground hover:text-background focused:bg-foreground focused:text-background',
  // Flat/transparent — reserved for nav pills and icon-only buttons.
  ghost: 'bg-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground',
  // Frosted-glass chip with a bright edge — secondary / on-image actions.
  glass: 'glass-controls border border-white/15 hover:bg-surface-3 hover:border-white/25',
  // A card lays out block-level composite content (image + title + meta), so it
  // drops the inline button sizing and neutralises the native text-align.
  card: 'flex flex-col items-start justify-start h-auto gap-2 p-0 bg-transparent text-left hover:bg-transparent',
}

type ButtonProps = Omit<ComponentProps<typeof BaseButton>, 'render'> & {
  variant?: LolarrButtonVariant
  size?: LolarrButtonSize
}

export function Button({ variant = 'secondary', size = 'md', className, ...props }: ButtonProps) {
  return (
    <BaseButton
      data-slot="button"
      className={cn(BASE, SIZES[size], VARIANTS[variant], className)}
      {...props}
    />
  )
}
