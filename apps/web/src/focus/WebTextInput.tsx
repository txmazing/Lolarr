import { type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { pause, resume } from '@noriginmedia/norigin-spatial-navigation-core'
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation-react'
import { Input, cn, type TextInputProps } from '@lolarr/ui'

export function WebTextInput({
  ariaLabel,
  autoComplete,
  className = '',
  defaultValue,
  enterKeyHint,
  focusKey,
  name,
  nextFocusKey,
  onValueChange,
  placeholder,
  required,
  submitOnEnter,
  type = 'text',
  value,
}: TextInputProps) {
  const { ref } = useFocusable({ focusKey, focusable: true })

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      // Feld verlassen → onBlur resume()t die Spatial-Navigation.
      event.currentTarget.blur()
      return
    }

    if (event.key !== 'Enter') {
      return
    }

    if (nextFocusKey) {
      event.preventDefault()
      const next = document.querySelector<HTMLInputElement>(
        `input[data-focus-key="${nextFocusKey}"]`,
      )
      event.currentTarget.blur()
      next?.focus()
      return
    }

    if (submitOnEnter) {
      event.preventDefault()
      event.currentTarget.blur()
      event.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <Input
      ref={ref}
      aria-label={ariaLabel}
      autoComplete={autoComplete}
      className={cn(className)}
      data-focus-key={focusKey}
      defaultValue={defaultValue}
      enterKeyHint={enterKeyHint}
      name={name}
      onChange={(event) => onValueChange?.(event.currentTarget.value)}
      // Beim Fokus Spatial-Nav pausieren → Pfeile/Home/End bewegen den Cursor,
      // Tippen verschiebt nie das Grid. Blur setzt fort.
      onFocus={() => pause()}
      onBlur={() => resume()}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      required={required}
      type={type}
      value={value}
    />
  )
}
