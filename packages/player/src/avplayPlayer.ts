// The Tizen runtime globals (webapis/tizen) live in an ambient .d.ts with no
// exports, so `import` cannot carry them; a path reference makes every consumer
// of this module see the globals without a per-consumer tsconfig entry.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./tizen.d.ts" />
import type { StreamSource } from '@lolarr/jellyfin'
import type { Player, PlayerEvent, PlayerHost } from './types.js'

const POLL_MS = 500
const HLS_RESUME_SEEK_DELAY_MS = 1500
const PREPARE_TIMEOUT_MS = 60_000
const SEEK_RETRY_LIMIT = 8
const SEEK_RETRY_DELAY_MS = 120
const USER_AGENT = 'Lolarr/0.1.0'

export class AVPlayPlayer implements Player {
  private readonly element: HTMLObjectElement
  private readonly handlers = new Map<PlayerEvent, Set<(detail?: unknown) => void>>()
  private readonly onVisibility: () => void
  private pollTimer: ReturnType<typeof setInterval> | undefined
  private resumeSeekTimer: ReturnType<typeof setTimeout> | undefined
  private lastPaused = true
  private stopped = false
  private pausedIntentionally = false
  private wasPlayingBeforeHidden = false

  constructor(host: PlayerHost) {
    this.element = document.createElement('object')
    this.element.type = 'application/avplayer'
    // Imperative element (outside React/Tailwind) — size it inline.
    this.element.style.width = '100%'
    this.element.style.height = '100%'
    host.container.appendChild(this.element)
    this.onVisibility = () => this.handleVisibilityChange()
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  private handleVisibilityChange() {
    if (this.stopped) {
      return
    }
    if (document.hidden) {
      if (webapis.avplay.getState() === 'PLAYING') {
        this.wasPlayingBeforeHidden = true
        this.pause()
      }
    } else if (this.wasPlayingBeforeHidden) {
      this.wasPlayingBeforeHidden = false
      this.play()
    }
  }

  async load(source: StreamSource, opts: { startSeconds?: number }) {
    const state = webapis.avplay.getState()
    if (state !== 'NONE' && state !== 'IDLE') {
      try {
        webapis.avplay.stop()
      } catch {
        // ignore stop failures when resetting a lingering session
      }
      try {
        webapis.avplay.close()
      } catch {
        // ignore close failures when resetting a lingering session
      }
    }

    webapis.avplay.open(source.url)
    webapis.avplay.setDisplayRect(0, 0, 1920, 1080)
    webapis.avplay.setListener({
      onbufferingstart: () => this.emit('waiting'),
      onbufferingcomplete: () => this.emit('playing'),
      oncurrentplaytime: () => {},
      onstreamcompleted: () => this.emit('ended'),
      onerror: () => this.emitError(),
      onerrormsg: () => this.emitError(),
    })

    if (source.kind === 'hls') {
      try {
        webapis.avplay.setStreamingProperty('USER_AGENT', USER_AGENT)
      } catch {
        try {
          webapis.avplay.setStreamingProperty('USERAGENT', USER_AGENT)
        } catch (error) {
          console.warn('[avplay] failed to set the streaming user-agent', error)
        }
      }
    }

    try {
      await this.prepare()
    } catch {
      this.emitError()
      return
    }
    if (this.stopped) {
      return
    }

    const startSeconds = opts.startSeconds ?? 0
    if (source.kind === 'hls') {
      webapis.avplay.play()
      if (startSeconds > 0) {
        this.resumeSeekTimer = setTimeout(() => this.seek(startSeconds), HLS_RESUME_SEEK_DELAY_MS)
      }
    } else {
      if (startSeconds > 0) {
        this.seek(startSeconds)
      }
      webapis.avplay.play()
    }

    this.startPolling()
  }

  play() {
    this.pausedIntentionally = false
    const state = webapis.avplay.getState()
    if (state === 'PAUSED' || state === 'READY') {
      webapis.avplay.play()
    }
  }

  pause() {
    this.pausedIntentionally = true
    if (webapis.avplay.getState() === 'PLAYING') {
      webapis.avplay.pause()
    }
  }

  seek(seconds: number) {
    this.seekWithRetry(Math.max(0, Math.round(seconds * 1000)), 0)
  }

  setVolume() {
    // AVPlay exposes no volume API; system volume is handled by the TV remote.
  }

  getPosition() {
    return webapis.avplay.getCurrentTime() / 1000
  }

  getDuration() {
    return webapis.avplay.getDuration() / 1000
  }

  isPaused() {
    return webapis.avplay.getState() === 'PAUSED'
  }

  on(event: PlayerEvent, handler: (detail?: unknown) => void) {
    const set = this.handlers.get(event) ?? new Set()
    set.add(handler)
    this.handlers.set(event, set)
    return () => set.delete(handler)
  }

  dispose() {
    this.stopped = true
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.stopPolling()
    if (this.resumeSeekTimer !== undefined) {
      clearTimeout(this.resumeSeekTimer)
      this.resumeSeekTimer = undefined
    }
    const state = webapis.avplay.getState()
    if (state !== 'NONE' && state !== 'IDLE') {
      try {
        webapis.avplay.stop()
      } catch {
        // ignore stop failures during teardown
      }
    }
    try {
      webapis.avplay.close()
    } catch {
      // ignore close failures during teardown
    }
    this.handlers.clear()
    this.element.remove()
  }

  private prepare(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true
          reject(new Error('AVPlay prepare timed out'))
        }
      }, PREPARE_TIMEOUT_MS)
      webapis.avplay.prepareAsync(
        () => {
          if (settled) {
            return
          }
          settled = true
          clearTimeout(timeout)
          resolve()
        },
        (error) => {
          if (settled) {
            return
          }
          settled = true
          clearTimeout(timeout)
          reject(error instanceof Error ? error : new Error('AVPlay prepare failed'))
        },
      )
    })
  }

  private seekWithRetry(ms: number, attempt: number) {
    if (this.stopped) {
      return
    }
    try {
      webapis.avplay.seekTo(ms)
    } catch (error) {
      if (attempt < SEEK_RETRY_LIMIT && isInvalidState(error)) {
        setTimeout(() => this.seekWithRetry(ms, attempt + 1), SEEK_RETRY_DELAY_MS)
      } else {
        console.warn(`[avplay] seekTo(${ms}) gave up after ${attempt} retries`, error)
      }
    }
  }

  private startPolling() {
    this.stopPolling()
    this.pollTimer = setInterval(() => {
      const paused = webapis.avplay.getState() === 'PAUSED'
      if (paused !== this.lastPaused) {
        this.lastPaused = paused
        this.emit(paused ? 'pause' : 'playing')
      }
      this.emit('timeupdate')
    }, POLL_MS)
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = undefined
    }
  }

  private emitError() {
    // Suppress errors during teardown and while the user has intentionally
    // paused — AVPlay can surface spurious errors in the paused state.
    if (!this.stopped && !this.pausedIntentionally) {
      this.emit('error')
    }
  }

  private emit(event: PlayerEvent, detail?: unknown) {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(detail)
    }
  }
}

function isInvalidState(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name ?? ''
  const message = (error as { message?: string } | null)?.message ?? ''
  return /invalid.?state/i.test(name) || /invalid.?state/i.test(message)
}
