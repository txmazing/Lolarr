import { Input } from './ui/Input'
import type { TextInputProps } from './types'

export function DefaultTextInput({
  ariaLabel,
  autoComplete,
  className,
  defaultValue,
  enterKeyHint,
  name,
  onValueChange,
  placeholder,
  required,
  type = 'text',
  value,
}: TextInputProps) {
  return (
    <Input
      aria-label={ariaLabel}
      autoComplete={autoComplete}
      className={className}
      defaultValue={defaultValue}
      enterKeyHint={enterKeyHint}
      name={name}
      onChange={(event) => onValueChange?.(event.currentTarget.value)}
      placeholder={placeholder}
      required={required}
      type={type}
      value={value}
    />
  )
}
