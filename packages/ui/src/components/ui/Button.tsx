import type { ComponentProps } from 'react'
import { Button as BaseButton } from '@base-ui/react/button'
import { cn } from '@ui/lib/utils'

export type LolarrButtonVariant = 'primary' | 'secondary' | 'ghost' | 'glass' | 'card'
export type LolarrButtonSize = 'md' | 'lg'

const BASE =
  'group inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent text-sm font-medium whitespace-nowrap outline-none select-none transition-[transform,background-color,color] duration-[370ms] ease-out-expo focus-visible:ring-3 focus-visible:ring-ring/50 focused:scale-[1.04] focused:bg-control-hover disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-[18px]'

// Standard control height (44px) — matches Input so buttons and fields line up.
const SIZES: Record<LolarrButtonSize, string> = { md: 'h-11 px-4', lg: 'h-12 px-5' }

// Bare control: no fill, no border, own backdrop-blur — fills on hover only.
const BARE = 'bg-transparent text-foreground/90 backdrop-blur-[8px] hover:bg-control-hover hover:text-foreground'

const VARIANTS: Record<LolarrButtonVariant, string> = {
  // Solid near-white fill + near-black text — the single strong CTA per screen.
  primary: 'bg-primary-solid text-background font-semibold hover:bg-primary-solid',
  // Bare control — same look as ghost/glass, kept as a distinct variant name for call sites.
  secondary: BARE,
  // Bare control — reserved for nav pills and icon-only buttons.
  ghost: BARE,
  // Bare control — secondary / on-image actions.
  glass: BARE,
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
