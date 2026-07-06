import { init as initSpatialNavigation } from '@noriginmedia/norigin-spatial-navigation-core'

let isSpatialNavigationInitialized = false

export function initializeSpatialNavigation() {
  if (isSpatialNavigationInitialized || typeof window === 'undefined') {
    return
  }

  initSpatialNavigation({
    debug: false,
    visualDebug: false,
    throttle: 0,
    // Gehaltene Pfeiltaste sauber wiederholen (Desktop-Autorepeat).
    throttleKeypresses: true,
    // Echter DOM-Fokus → :focus-visible + a11y + natives Enter/Klick.
    shouldFocusDOMNode: true,
    // Norigins Fokus soll NICHT nativ scrollen — wir kontrollieren Scroll selbst
    // über den geteilten focusScroll-Helper.
    domNodeFocusOptions: { preventScroll: true },
    distanceCalculationMethod: 'corners',
  })

  isSpatialNavigationInitialized = true
}
