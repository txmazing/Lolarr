import type { ComponentProps } from 'react'
import { Button as ShadcnButton } from '@ui/components/ui/shadcn/button'
import { cn } from '@ui/lib/utils'

export type LolarrButtonVariant = 'primary' | 'ghost' | 'glass' | 'card'
export type LolarrButtonSize = 'md' | 'lg'

const VARIANT_TO_SHADCN = {
  primary: 'default',
  ghost: 'outline',
  glass: 'outline',
  card: 'ghost',
} as const

const VARIANT_EXTRA: Record<LolarrButtonVariant, string> = {
  primary: '',
  ghost: 'bg-transparent hover:bg-surface-2',
  glass: 'glass-controls border-border hover:bg-surface-3',
  // A card lays out block-level composite content (image + title + meta),
  // so it neutralizes the shadcn Button's inline-flex/h-8/px-2.5 defaults
  // instead of each call-site fighting them with override utilities.
  card: 'flex flex-col items-start justify-start h-auto p-0 gap-2 bg-transparent hover:bg-transparent',
}

const SIZE_TO_SHADCN = { md: 'default', lg: 'lg' } as const

type ButtonProps = Omit<ComponentProps<typeof ShadcnButton>, 'variant' | 'size'> & {
  variant?: LolarrButtonVariant
  size?: LolarrButtonSize
}

export function Button({ variant = 'ghost', size = 'md', className, ...props }: ButtonProps) {
  return (
    <ShadcnButton
      variant={VARIANT_TO_SHADCN[variant]}
      size={SIZE_TO_SHADCN[size]}
      className={cn(
        'transition-[transform,background-color,border-color] duration-[350ms] ease-out-expo',
        'focused:scale-[1.06] focused:border-ring focused:bg-surface-3',
        VARIANT_EXTRA[variant],
        className,
      )}
      {...props}
    />
  )
}
