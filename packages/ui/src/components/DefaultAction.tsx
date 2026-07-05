import { Button } from './ui/Button'
import type { ActionProps } from './types'

export function DefaultAction({
  ariaLabel,
  autoFocus,
  children,
  className,
  disabled,
  onPress,
  size,
  type = 'button',
  variant,
}: ActionProps) {
  return (
    <Button
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      type={type}
      variant={variant}
      size={size}
      className={className}
      disabled={disabled}
      onClick={onPress}
    >
      {children}
    </Button>
  )
}
