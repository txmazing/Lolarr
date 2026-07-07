import { useEffect, type ReactNode } from 'react'
import {
  doesFocusableExist,
  getCurrentFocusKey,
  setFocus,
} from '@noriginmedia/norigin-spatial-navigation-core'
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation-react'
import {
  OverlayScopeProvider,
  installFastNavTracking,
  installModalityTracking,
  installRailNavigation,
  type ShellProps,
} from '@lolarr/ui'

// Norigin-Fokus-Boundary für offene Dialoge — Pfeiltasten bleiben im Dialog
// gefangen (ergänzt Base UIs Tab-Trap). Spiegel von TvOverlayScope.
function WebOverlayScope({ children }: { children: ReactNode }) {
  const { ref, focusKey } = useFocusable({
    isFocusBoundary: true,
    trackChildren: true,
  })

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="contents">
        {children}
      </div>
    </FocusContext.Provider>
  )
}

export function WebShell({ children }: ShellProps) {
  const { ref, focusKey } = useFocusable({
    focusKey: 'APP',
    trackChildren: true,
  })

  // Modalitäts-Tracking installieren (Maus vs. Tastatur) für den Scroll-Guard.
  useEffect(() => installModalityTracking(), [])

  // Must install before installRailNavigation: rail nav stops immediate
  // propagation for rail-to-rail keys, and fast-nav must see every press.
  useEffect(() => installFastNavTracking(), [])

  // Content loads async (react-query), so there are no focusables at mount —
  // seeding then would focus nothing. Instead the first arrow key seeds focus
  // onto the app root's first focusable when nothing is focused yet, and
  // consumes that press (capture + stopImmediatePropagation) so Norigin does
  // not also navigate off the just-seeded element on the same keystroke.
  useEffect(() => {
    function seedOnFirstArrow(event: KeyboardEvent) {
      if (!event.key.startsWith('Arrow')) {
        return
      }
      const current = getCurrentFocusKey()
      if (current && doesFocusableExist(current)) {
        return
      }
      event.preventDefault()
      event.stopImmediatePropagation()
      setFocus('APP')
    }
    window.addEventListener('keydown', seedOnFirstArrow, true)
    return () => window.removeEventListener('keydown', seedOnFirstArrow, true)
  }, [])

  // Rail-grid navigation on top of Norigin: per-rail focus memory (Up/Down
  // resumes a rail where you left it) + forward snake (Right on the last card
  // jumps to the next rail). Registered after the seed effect so its capture
  // handler runs after seeding on the very first arrow press.
  useEffect(() => installRailNavigation({ setFocus, getCurrentFocusKey }), [])

  return (
    <OverlayScopeProvider value={WebOverlayScope}>
      <FocusContext.Provider value={focusKey}>
        <div ref={ref} className="app-shell">
          {children}
        </div>
      </FocusContext.Provider>
    </OverlayScopeProvider>
  )
}
