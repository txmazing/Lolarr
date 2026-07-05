import { useEffect, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { setFocus } from '@noriginmedia/norigin-spatial-navigation-core'
import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation-react'
import { LolarrApp } from '@lolarr/features'
import { Button, Input, cn, type ActionProps, type TextInputProps } from '@lolarr/ui'
import { isTizenPlayerAvailable, tizenPlatform, webPlatform } from '@lolarr/player'

function TvAction({
  ariaLabel,
  children,
  className = '',
  disabled,
  focusKey,
  onPress,
  size,
  type = 'button',
  variant,
}: ActionProps) {
  const { ref, focused } = useFocusable({
    focusKey,
    focusable: !disabled,
    onEnterPress: () => {
      if (onPress) {
        onPress()
        return
      }

      const button = ref.current as HTMLButtonElement | null
      button?.click()
    },
  })

  useEffect(() => {
    if (focused) {
      scrollFocusedElementIntoView(ref.current)
    }
  }, [focused, ref])

  return (
    <Button
      ref={ref}
      type={type}
      variant={variant}
      size={size}
      aria-label={ariaLabel}
      className={cn(className, focused && 'focused')}
      disabled={disabled}
      onClick={onPress}
    >
      {children}
    </Button>
  )
}

function TvTextInput({
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
  const { ref, focused, focusSelf } = useFocusable({
    focusKey,
    onEnterPress: () => {
      const input = ref.current as HTMLInputElement | null
      activateTextInput(input)
    },
    onArrowPress: () => {
      blurTextInput(ref.current as HTMLInputElement | null)
      return true
    },
    onBlur: () => {
      blurTextInput(ref.current as HTMLInputElement | null)
    },
  })

  useEffect(() => {
    if (focusKey === 'login-username' || focusKey === 'gateway-api-url') {
      focusSelf()
    }
  }, [focusKey, focusSelf])

  useEffect(() => {
    const input = ref.current as HTMLInputElement | null

    if (focused) {
      scrollFocusedElementIntoView(input)
      return
    }

    blurTextInput(input)
  }, [focused, ref])

  useEffect(() => {
    const handleBackKey = (event: KeyboardEvent) => {
      const input = ref.current as HTMLInputElement | null

      if (document.activeElement !== input || !isBackKey(event)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      blurTextInput(input)
    }

    window.addEventListener('keydown', handleBackKey, true)
    return () => window.removeEventListener('keydown', handleBackKey, true)
  }, [ref])

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (isBackKey(event.nativeEvent)) {
      event.preventDefault()
      event.stopPropagation()
      blurTextInput(event.currentTarget)
      return
    }

    if (event.key !== 'Enter') {
      return
    }

    if (nextFocusKey) {
      event.preventDefault()
      focusTextInputByKey(nextFocusKey)
      return
    }

    if (submitOnEnter) {
      event.preventDefault()
      blurTextInput(event.currentTarget)
      submitContainingForm(event.currentTarget)
      return
    }

    blurTextInput(event.currentTarget)
  }

  return (
    <Input
      ref={ref}
      aria-label={ariaLabel}
      autoComplete={autoComplete}
      className={cn(className, focused && 'focused')}
      data-focus-key={focusKey}
      defaultValue={defaultValue}
      enterKeyHint={enterKeyHint}
      name={name}
      onChange={(event) => onValueChange?.(event.currentTarget.value)}
      onFocus={(event) => {
        focusSelf()
        selectTextForEditing(event.currentTarget)
      }}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      required={required}
      type={type}
      value={value}
    />
  )
}

function TvShell({ children }: { children: ReactNode }) {
  const { ref, focusKey, focusSelf } = useFocusable({
    focusKey: 'APP',
    trackChildren: true,
  })

  useEffect(() => {
    focusSelf()
  }, [focusSelf])

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="app-shell">
        {children}
      </div>
    </FocusContext.Provider>
  )
}

// On a real Tizen device this is `tizenPlatform`; in a desktop browser dev
// session (no AVPlay runtime) it falls back to the HTML5 `webPlatform` so the
// app boots instead of throwing a ReferenceError on `webapis`/`tizen`.
const playerPlatform = isTizenPlayerAvailable() ? tizenPlatform : webPlatform

function App() {
  return (
    <LolarrApp
      Action={TvAction}
      TextInput={TvTextInput}
      Shell={TvShell}
      playerPlatform={playerPlatform}
    />
  )
}

export default App

function activateTextInput(input: HTMLInputElement | null) {
  if (!input) {
    return
  }

  blurActiveTextInput(input)
  input.focus()
  selectTextForEditing(input)
  scrollFocusedElementIntoView(input)
}

function blurTextInput(input: HTMLInputElement | null) {
  if (input && document.activeElement === input) {
    input.blur()
  }
}

function blurActiveTextInput(nextInput?: HTMLInputElement) {
  const activeElement = document.activeElement

  if (activeElement instanceof HTMLInputElement && activeElement !== nextInput) {
    activeElement.blur()
  }
}

function focusTextInputByKey(focusKey: string) {
  setFocus(focusKey)

  window.requestAnimationFrame(() => {
    const input = findTextInputByFocusKey(focusKey)

    if (input) {
      activateTextInput(input)
    }
  })
}

function findTextInputByFocusKey(focusKey: string) {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[data-focus-key]')).find(
    (input) => input.dataset.focusKey === focusKey,
  )
}

function submitContainingForm(input: HTMLInputElement) {
  const form = input.form

  if (!form) {
    return
  }

  if (typeof form.requestSubmit === 'function') {
    form.requestSubmit()
    return
  }

  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

function selectTextForEditing(input: HTMLInputElement) {
  if (input.type === 'password') {
    input.setSelectionRange(input.value.length, input.value.length)
    return
  }

  input.select()
}

function scrollFocusedElementIntoView(element: Element | null) {
  if (!element) {
    return
  }

  window.requestAnimationFrame(() => {
    try {
      element.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      })
    } catch {
      element.scrollIntoView(false)
    }
  })
}

function isBackKey(event: KeyboardEvent) {
  return event.key === 'Escape' || event.key === 'Backspace' || event.keyCode === 10009
}
