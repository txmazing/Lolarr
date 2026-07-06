import { useEffect, type ReactNode } from 'react'
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation-react'
import { OverlayScopeProvider, installModalityTracking, type ShellProps } from '@lolarr/ui'

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
  const { ref, focusKey, focusSelf } = useFocusable({
    focusKey: 'APP',
    trackChildren: true,
  })

  // Modalitäts-Tracking installieren (Maus vs. Tastatur) für den Scroll-Guard.
  useEffect(() => installModalityTracking(), [])

  // Fokus beim Mount seeden. Kein Streu-Ring für Maus-Nutzer: :focus-visible
  // triggert nur bei Tastatur, und WebAction gated .focused auf Keyboard-
  // Modalität (beim Mount = false) → sichtbarer Ring erst ab der ersten Taste.
  useEffect(() => {
    focusSelf()
  }, [focusSelf])

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
