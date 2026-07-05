import type { ComponentProps } from 'react'
import { Input as ShadcnInput } from '@ui/components/ui/shadcn/input'
import { cn } from '@ui/lib/utils'

export function Input({ className, ...props }: ComponentProps<typeof ShadcnInput>) {
  return (
    <ShadcnInput
      className={cn(
        'h-11 bg-surface border-border rounded-md transition-colors duration-[350ms] ease-out-expo',
        'focus-visible:ring-1 focus-visible:ring-ring',
        'focused:border-ring focused:bg-surface-2',
        className,
      )}
      {...props}
    />
  )
}
