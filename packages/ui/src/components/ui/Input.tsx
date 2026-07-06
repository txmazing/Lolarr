import { Input as BaseInput } from '@base-ui/react/input'
import { cn } from '@ui/lib/utils'

export function Input({ className, ...props }: BaseInput.Props) {
  return (
    <BaseInput
      data-slot="input"
      className={cn(
        'h-11 w-full min-w-0 rounded-md border border-border/60 bg-surface px-3 py-1 text-base backdrop-blur-[8px] outline-none transition-colors',
        'placeholder:text-muted-foreground',
        'focus-visible:border-ring focus-visible:bg-surface-2',
        'focused:border-ring focused:bg-surface-2',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
