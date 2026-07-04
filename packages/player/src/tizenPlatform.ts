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

export const tizenPlatform: PlayerPlatform = {
  createPlayer(host: PlayerHost) {
    return new AVPlayPlayer(host)
  },
  buildDeviceProfile: () => buildTizenDeviceProfile(),
  supportsVolume: false,
  registerMediaKeys() {
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
