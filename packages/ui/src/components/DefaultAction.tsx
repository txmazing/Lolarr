import type { ActionProps } from './types'

export function DefaultAction({
  children,
  className,
  disabled,
  onPress,
  type = 'button',
}: ActionProps) {
  return (
    <button
      type={type}
      className={className}
      disabled={disabled}
      onClick={onPress}
    >
      {children}
    </button>
  )
}
