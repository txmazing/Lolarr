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
    distanceCalculationMethod: 'corners',
  })

  isSpatialNavigationInitialized = true
}
