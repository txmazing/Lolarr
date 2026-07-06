// Geteiltes, Norigin-freies Modalitäts- + Anker-Scroll-Modul. Von WebAction
// (Web) und TvAction (TV) genutzt. Bewusst abhängigkeitsfrei (reines DOM), damit
// packages/ui die Spatial-Navigation-Lib nie importiert.

let keyboardModality = false

function markKeyboard() {
  keyboardModality = true
}

function markPointer() {
  keyboardModality = false
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
