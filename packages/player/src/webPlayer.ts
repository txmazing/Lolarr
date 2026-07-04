import Hls from 'hls.js'
import type { StreamSource } from '@lolarr/jellyfin'
import type { Player, PlayerEvent } from './types.js'

const VIDEO_EVENT_MAP: Array<[string, PlayerEvent]> = [
  ['timeupdate', 'timeupdate'],
  ['ended', 'ended'],
  ['error', 'error'],
  ['waiting', 'waiting'],
  ['playing', 'playing'],
  ['pause', 'pause'],
]

export class WebPlayer implements Player {
  private readonly video: HTMLVideoElement
  private hls: Hls | undefined
  private readonly handlers = new Map<PlayerEvent, Set<(detail?: unknown) => void>>()
  private readonly domCleanups: Array<() => void> = []

  constructor(video: HTMLVideoElement) {
    this.video = video
    for (const [domEvent, playerEvent] of VIDEO_EVENT_MAP) {
      const listener = () => this.emit(playerEvent)
      video.addEventListener(domEvent, listener)
      this.domCleanups.push(() => video.removeEventListener(domEvent, listener))
    }
  }

  async load(source: StreamSource, opts: { startSeconds?: number }) {
    this.teardownHls()

    if (source.kind === 'hls' && Hls.isSupported()) {
      this.hls = new Hls()
      this.hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          this.emit('error', data)
        }
      })
      this.hls.loadSource(source.url)
      this.hls.attachMedia(this.video)
    } else {
      // direct play — or native HLS (Safari)
      this.video.src = source.url
    }

    if (opts.startSeconds && opts.startSeconds > 0) {
      this.video.currentTime = opts.startSeconds
    }
    await this.video.play().catch(() => {
      // Autoplay blocked: emit a synthetic pause so the session's paused
      // state matches reality — the user must resume via controls.
      this.emit('pause')
    })
  }

  play() {
    void this.video.play().catch(() => {})
  }

  pause() {
    this.video.pause()
  }

  seek(seconds: number) {
    this.video.currentTime = Math.max(0, seconds)
  }

  setVolume(volume: number) {
    this.video.volume = Math.min(1, Math.max(0, volume))
  }

  getPosition() {
    return this.video.currentTime
  }

  getDuration() {
    return this.video.duration
  }

  isPaused() {
    return this.video.paused
  }

  on(event: PlayerEvent, handler: (detail?: unknown) => void) {
    const set = this.handlers.get(event) ?? new Set()
    set.add(handler)
    this.handlers.set(event, set)
    return () => set.delete(handler)
  }

  dispose() {
    this.teardownHls()
    for (const cleanup of this.domCleanups) {
      cleanup()
    }
    this.handlers.clear()
    this.video.removeAttribute('src')
    this.video.load()
  }

  private teardownHls() {
    this.hls?.destroy()
    this.hls = undefined
  }

  private emit(event: PlayerEvent, detail?: unknown) {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(detail)
    }
  }
}
