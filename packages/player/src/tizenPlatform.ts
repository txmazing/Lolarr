import { AVPlayPlayer } from './avplayPlayer.js'
import { buildTizenDeviceProfile } from './tizenDeviceProfile.js'
import type { PlayerHost, PlayerPlatform } from './types.js'

const MEDIA_KEYS = [
  'MediaPlay',
  'MediaPause',
  'MediaPlayPause',
  'MediaStop',
  'MediaRewind',
  'MediaFastForward',
]

/**
 * True only on a real Tizen device, where the native AVPlay runtime exists.
 * Running the TV app in a desktop browser (`pnpm --filter @lolarr/tv dev`) has
 * no `webapis`, so callers should fall back to `webPlatform` there.
 */
export function isTizenPlayerAvailable(): boolean {
  return typeof webapis !== 'undefined' && typeof webapis.avplay !== 'undefined'
}

export const tizenPlatform: PlayerPlatform = {
  createPlayer(host: PlayerHost) {
    return new AVPlayPlayer(host)
  },
  buildDeviceProfile: () => buildTizenDeviceProfile(),
  supportsVolume: false,
  registerMediaKeys() {
    if (typeof tizen === 'undefined') {
      return () => {}
    }
    const supported = new Set(tizen.tvinputdevice.getSupportedKeys().map((key) => key.name))
    const registered: string[] = []
    for (const name of MEDIA_KEYS) {
      if (supported.has(name)) {
        try {
          tizen.tvinputdevice.registerKey(name)
          registered.push(name)
        } catch {
          // ignore firmware that rejects a supported-looking key
        }
      }
    }
    return () => {
      for (const name of registered) {
        try {
          tizen.tvinputdevice.unregisterKey(name)
        } catch {
          // ignore unregister failures during teardown
        }
      }
    }
  },
}
