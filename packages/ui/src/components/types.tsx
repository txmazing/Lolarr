import type { ComponentType, ReactNode } from 'react'

export type ActionProps = {
  ariaLabel?: string
  children: ReactNode
  className?: string
  disabled?: boolean
  focusKey?: string
  onPress?: () => void
  size?: 'md' | 'lg'
  type?: 'button' | 'submit'
  variant?: 'primary' | 'ghost' | 'glass'
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
