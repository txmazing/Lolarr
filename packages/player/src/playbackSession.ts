import type { JellyfinSession } from '@lolarr/domain'
import {
  buildStreamSource,
  buildStoppedBeaconPayload,
  getPlaybackInfo,
  reportPlaybackProgress,
  reportPlaybackStart,
  reportPlaybackStopped,
  stopActiveEncodings,
  type MediaSourceInfo,
  type PlaybackProgressInfo,
  type StreamSource,
} from '@lolarr/jellyfin'
import { buildDeviceProfile } from './deviceProfile.js'
import type { Player } from './types.js'

export type PlaybackSessionState = 'loading' | 'playing' | 'paused' | 'ended' | 'error'

export type PlaybackApi = {
  getPlaybackInfo: typeof getPlaybackInfo
  buildStreamSource: typeof buildStreamSource
  reportPlaybackStart: typeof reportPlaybackStart
  reportPlaybackProgress: typeof reportPlaybackProgress
  reportPlaybackStopped: typeof reportPlaybackStopped
  stopActiveEncodings: typeof stopActiveEncodings
}

export type PlaybackSessionHandle = {
  start(): Promise<void>
  togglePause(): void
  seekBy(seconds: number): void
  seekTo(seconds: number): void
  stop(): Promise<void>
  getProgress(): { position: number; duration: number }
}

const defaultApi: PlaybackApi = {
  getPlaybackInfo,
  buildStreamSource,
  reportPlaybackStart,
  reportPlaybackProgress,
  reportPlaybackStopped,
  stopActiveEncodings,
}

const PROGRESS_INTERVAL_MS = 10_000
const TICKS_PER_SECOND = 10_000_000

export function createPlaybackSession(deps: {
  session: JellyfinSession
  player: Player
  itemId: string
  resumeTicks?: number
  onStateChange(state: PlaybackSessionState, detail?: { message?: string }): void
  api?: PlaybackApi
  deviceProfile?: unknown
}): PlaybackSessionHandle {
  const api = deps.api ?? defaultApi
  const deviceProfile = deps.deviceProfile ?? buildDeviceProfile()
  const { session, player, itemId, onStateChange } = deps

  let current: { source: StreamSource; mediaSource: MediaSourceInfo; playSessionId: string } | undefined
  let paused = false
  let retried = false
  let stopped = false
  let progressTimer: ReturnType<typeof setInterval> | undefined
  const unsubscribes: Array<() => void> = []

  function progressInfo(): PlaybackProgressInfo | undefined {
    if (!current) {
      return undefined
    }
    return {
      itemId,
      mediaSourceId: current.mediaSource.id,
      playSessionId: current.playSessionId,
      positionTicks: Math.round(player.getPosition() * TICKS_PER_SECOND),
      isPaused: paused,
      playMethod: current.source.kind === 'direct' ? 'DirectPlay' : 'Transcode',
    }
  }

  function reportProgress() {
    const info = progressInfo()
    if (info) {
      void api.reportPlaybackProgress(session, info).catch(() => {})
    }
  }

  async function negotiate(enableDirectPlay: boolean) {
    const info = await api.getPlaybackInfo(session, itemId, {
      deviceProfile,
      startTimeTicks: deps.resumeTicks,
      enableDirectPlay,
    })
    const mediaSource = info.mediaSources.find((source) => source.supportsDirectPlay && enableDirectPlay)
      ?? info.mediaSources.find((source) => source.transcodingUrl)
      ?? info.mediaSources[0]
    const source = mediaSource ? api.buildStreamSource(session, itemId, mediaSource, info.playSessionId) : null

    if (!mediaSource || !source) {
      onStateChange('error', { message: 'No playable media source' })
      return false
    }

    current = { source, mediaSource, playSessionId: info.playSessionId }
    await player.load(source, {
      startSeconds: deps.resumeTicks ? deps.resumeTicks / TICKS_PER_SECOND : undefined,
    })
    return true
  }

  async function handlePlayerError() {
    if (stopped) {
      return
    }
    if (current?.source.kind === 'direct' && !retried) {
      retried = true
      onStateChange('loading')
      try {
        const ok = await negotiate(false)
        if (ok) {
          const info = progressInfo()
          if (info) {
            void api.reportPlaybackStart(session, info).catch(() => {})
          }
        }
      } catch {
        onStateChange('error', { message: 'Playback failed' })
      }
      return
    }
    onStateChange('error', { message: 'Playback failed' })
  }

  function handlePageHide() {
    const info = progressInfo()
    if (info && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const beacon = buildStoppedBeaconPayload(session, info)
      navigator.sendBeacon(beacon.url, new Blob([beacon.body], { type: 'application/json' }))
    }
  }

  return {
    async start() {
      onStateChange('loading')
      unsubscribes.push(
        player.on('playing', () => {
          paused = false
          reportProgress()
          onStateChange('playing')
        }),
        player.on('pause', () => {
          paused = true
          onStateChange('paused')
          reportProgress()
        }),
        player.on('ended', () => onStateChange('ended')),
        player.on('error', () => {
          void handlePlayerError()
        }),
      )
      if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', handlePageHide)
        unsubscribes.push(() => window.removeEventListener('pagehide', handlePageHide))
      }

      try {
        const ok = await negotiate(true)
        if (!ok) {
          return
        }
      } catch {
        onStateChange('error', { message: 'Playback failed' })
        return
      }

      const info = progressInfo()
      if (info) {
        void api.reportPlaybackStart(session, info).catch(() => {})
      }
      onStateChange('playing')
      progressTimer = setInterval(reportProgress, PROGRESS_INTERVAL_MS)
    },

    togglePause() {
      if (paused) {
        player.play()
      } else {
        player.pause()
      }
    },

    seekBy(seconds) {
      player.seek(player.getPosition() + seconds)
      reportProgress()
    },

    seekTo(seconds) {
      player.seek(seconds)
      reportProgress()
    },

    async stop() {
      if (stopped) {
        return
      }
      stopped = true
      if (progressTimer) {
        clearInterval(progressTimer)
      }
      const info = progressInfo()
      for (const unsubscribe of unsubscribes) {
        unsubscribe()
      }
      if (info) {
        await api.reportPlaybackStopped(session, info).catch(() => {})
        if (current?.source.kind === 'hls') {
          await api.stopActiveEncodings(session, current.playSessionId).catch(() => {})
        }
      }
      player.dispose()
    },

    getProgress() {
      return { position: player.getPosition(), duration: player.getDuration() }
    },
  }
}
