import type { ComponentType, ReactNode } from 'react'

export type ActionProps = {
  ariaLabel?: string
  // Seed platform focus onto this action when it mounts. On TV the injected
  // Action calls Norigin's focusSelf(), which is how an opening overlay hands
  // focus to its first control (Base UI's modal auto-focus is disabled so
  // Norigin keeps focus authority — see GlassDialog).
  autoFocus?: boolean
  children: ReactNode
  className?: string
  disabled?: boolean
  focusKey?: string
  onPress?: () => void
  size?: 'md' | 'lg'
  type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary' | 'ghost' | 'glass' | 'card'
}

export type ActionComponent = ComponentType<ActionProps>

export type TextInputProps = {
  ariaLabel?: string
  autoComplete?: string
  className?: string
  defaultValue?: string
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send'
  focusKey?: string
  name?: string
  nextFocusKey?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  required?: boolean
  submitOnEnter?: boolean
  type?: 'text' | 'password'
  value?: string
}

export type TextInputComponent = ComponentType<TextInputProps>

export type ShellProps = {
  children: ReactNode
}
