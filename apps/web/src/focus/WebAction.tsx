import { useEffect } from 'react'
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation-react'
import {
  Button,
  cn,
  isKeyboardModality,
  scrollFocusedIntoView,
  type ActionProps,
} from '@lolarr/ui'

export function WebAction({
  ariaLabel,
  autoFocus,
  children,
  className = '',
  disabled,
  focusKey,
  onPress,
  size,
  type = 'button',
  variant,
}: ActionProps) {
  const { ref, focused, focusSelf } = useFocusable({
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

  // Overlay-Primärbutton beim Öffnen fokussieren (Base UIs Auto-Focus ist aus,
  // damit Norigin die Fokus-Hoheit behält — analog TvAction).
  useEffect(() => {
    if (autoFocus) {
      focusSelf()
    }
  }, [autoFocus, focusSelf])

  // Bei Fokuswechsel scrollen — der Helper scrollt nur unter Keyboard-Modalität.
  useEffect(() => {
    if (focused) {
      scrollFocusedIntoView(ref.current, { smooth: true })
    }
  }, [focused, ref])

  return (
    <Button
      ref={ref}
      type={type}
      variant={variant}
      size={size}
      aria-label={ariaLabel}
      // .focused NUR bei Tastatur → Maus-Hover expandiert via :hover (kollabiert
      // beim Verlassen) statt die persistente .focused-Klasse kleben zu lassen.
      className={cn(className, focused && isKeyboardModality() && 'focused')}
      disabled={disabled}
      onClick={onPress}
      // Queryable by the rail-navigation controller (per-rail memory + snake).
      data-focus-key={focusKey}
      // Maus↔Tastatur-Sync: Hover verschiebt Norigins aktuellen Knoten hierher,
      // sodass Pfeiltasten von der gehoverten Card weiternavigieren. Nur unter
      // Pointer-Modalität — sonst würde Content, der beim Tastatur-Scrollen unter
      // dem stehenden Cursor durchläuft, den Fokus klauen.
      onPointerEnter={() => {
        if (!disabled && !isKeyboardModality()) {
          focusSelf()
        }
      }}
    >
      {children}
    </Button>
  )
}
