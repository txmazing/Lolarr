import { buildDeviceProfile } from './deviceProfile.js'
import type { PlayerHost, PlayerPlatform } from './types.js'
import { WebPlayer } from './webPlayer.js'

export const webPlatform: PlayerPlatform = {
  createPlayer(host: PlayerHost) {
    const video = document.createElement('video')
    video.className = 'player-video'
    video.playsInline = true
    host.container.appendChild(video)
    return new WebPlayer(video, () => video.remove())
  },
  buildDeviceProfile: () => buildDeviceProfile(),
  supportsVolume: true,
}
