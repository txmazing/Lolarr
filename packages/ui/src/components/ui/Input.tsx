import { Input as BaseInput } from '@base-ui/react/input'
import { cn } from '@ui/lib/utils'

export function Input({ className, ...props }: BaseInput.Props) {
  return (
    <BaseInput
      data-slot="input"
      className={cn(
        'h-11 w-full min-w-0 rounded-md border border-border bg-surface px-2.5 py-1 text-base outline-none transition-colors duration-[350ms] ease-out-expo',
        'placeholder:text-muted-foreground',
        'focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring',
        'focused:border-ring focused:bg-surface-2',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
