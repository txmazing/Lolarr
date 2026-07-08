// Geteiltes, Norigin-freies Modalitäts- + Anker-Scroll-Modul. Von WebAction
// (Web) und TvAction (TV) genutzt. Bewusst abhängigkeitsfrei (reines DOM), damit
// packages/ui die Spatial-Navigation-Lib nie importiert.

let keyboardModality = false

// Mirror the modality onto the document root so CSS can suppress mouse-only
// affordances (card hover-expand) while the keyboard drives navigation — a
// stationary cursor must not trigger hover on cards scrolling under it.
function reflectModality() {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.navInput = keyboardModality ? 'keyboard' : 'pointer'
  }
}

function markKeyboard() {
  keyboardModality = true
  reflectModality()
}

function markPointer() {
  keyboardModality = false
  reflectModality()
}

export function isKeyboardModality(): boolean {
  return keyboardModality
}

// Fenster-Listener: verfolgt, ob die letzte Eingabe Tastatur (Pfeil/Fernbedienung)
// oder Pointer (Maus) war. Gibt Cleanup zurück. WebShell und TvShell rufen das
// je einmal beim Mount. Auf TV gibt es keine Pointer-Events → die erste
// Fernbedienungstaste kippt das Flag auf true und es bleibt true.
export function installModalityTracking(): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  window.addEventListener('keydown', markKeyboard, true)
  window.addEventListener('pointerdown', markPointer, true)
  window.addEventListener('pointermove', markPointer, true)

  return () => {
    window.removeEventListener('keydown', markKeyboard, true)
    window.removeEventListener('pointerdown', markPointer, true)
    window.removeEventListener('pointermove', markPointer, true)
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

// Bringt das fokussierte Element mit konsistentem Anker in den Blick:
//  - innerhalb eines [data-focus-scroll-region] (der Hero): die ganze Region
//    oben zeigen (block:'start'), respektiert scroll-padding-block-start.
//  - sonst (Rail-Card/Row): Reihe zentrieren (block:'center') + horizontal zur
//    nächsten Kante (inline:'nearest'); die scroll-padding-inline der Rail lässt
//    einen Peek der Nachbar-Card.
// Scrollt nur, wenn die letzte Eingabe Tastatur/Fernbedienung war — Maus-Hover
// reißt die Seite nie weg.
export function scrollFocusedIntoView(
  element: Element | null,
  options: { smooth?: boolean } = {},
): void {
  if (!element || !isKeyboardModality() || typeof window === 'undefined') {
    return
  }

  const behavior: ScrollBehavior =
    options.smooth && !prefersReducedMotion() ? 'smooth' : 'auto'

  window.requestAnimationFrame(() => {
    const region = element.closest('[data-focus-scroll-region]')

    try {
      if (region) {
        region.scrollIntoView({ block: 'start', behavior })
        return
      }

      element.scrollIntoView({ block: 'center', inline: 'nearest', behavior })
    } catch {
      element.scrollIntoView(false)
    }
  })
}

// Rapid arrow-key navigation (held key or fast tapping) mirrors onto the root
// as data-nav-fast so CSS can suspend the expensive card transitions (width
// morph, glow, crossfade) and let focus snap. The attribute clears shortly
// after the last press, so the morph only plays once focus settles. A single
// isolated press never enters fast mode — normal navigation stays animated.
const FAST_NAV_INTERVAL_MS = 250
const FAST_NAV_CLEAR_MS = 200
const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

export function installFastNavTracking(): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  let lastArrowAt = Number.NEGATIVE_INFINITY
  let clearTimer: ReturnType<typeof setTimeout> | undefined

  function setFast(fast: boolean) {
    if (fast) {
      document.documentElement.dataset.navFast = 'true'
    } else {
      delete document.documentElement.dataset.navFast
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!ARROW_KEYS.has(event.key)) {
      return
    }
    const now = Date.now()
    if (event.repeat || now - lastArrowAt < FAST_NAV_INTERVAL_MS) {
      setFast(true)
      if (clearTimer !== undefined) {
        clearTimeout(clearTimer)
      }
      clearTimer = setTimeout(() => setFast(false), FAST_NAV_CLEAR_MS)
    }
    lastArrowAt = now
  }

  window.addEventListener('keydown', handleKeydown, true)
  return () => {
    window.removeEventListener('keydown', handleKeydown, true)
    if (clearTimer !== undefined) {
      clearTimeout(clearTimer)
    }
    setFast(false)
  }
}
