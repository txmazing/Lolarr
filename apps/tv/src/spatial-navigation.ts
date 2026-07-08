import { init as initSpatialNavigation } from '@noriginmedia/norigin-spatial-navigation-core'

let isSpatialNavigationInitialized = false

export function initializeSpatialNavigation() {
  if (isSpatialNavigationInitialized || typeof window === 'undefined') {
    return
  }

  initSpatialNavigation({
    debug: false,
    visualDebug: false,
    // Rattling the remote at 0 throttle re-measures the whole focusable
    // geometry per key repeat; 100ms caps that without feeling laggy on the
    // device. Calibrate on the S94C (Task 7) — raise/lower if needed.
    throttle: 100,
    distanceCalculationMethod: 'corners',
  })

  isSpatialNavigationInitialized = true
}
