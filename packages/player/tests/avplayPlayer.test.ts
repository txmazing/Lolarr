// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StreamSource } from '@lolarr/jellyfin'
import { AVPlayPlayer } from '../src/avplayPlayer.js'

type Listener = Record<string, ((...args: unknown[]) => void) | undefined>

// The `avplay` methods below are rebound to the outer `fake` object in
// `beforeEach` (via `.bind(fake)`), so `this` at call time is `FakeAvplayHost`
// rather than the `avplay` literal itself. Typing `this` explicitly here
// reflects that real runtime shape and keeps the `as Record<string, unknown>`
// cast (needed for the rebind loop) from collapsing `this` to `unknown`.
interface FakeAvplayHost {
  calls: string[]
  streamingProps: Record<string, string>
  seekThrows: number
}

function fakeAvplay() {
  let state = 'IDLE'
  let listener: Listener = {}
  return {
    calls: [] as string[],
    streamingProps: {} as Record<string, string>,
    seekThrows: 0,
    setState(next: string) {
      state = next
    },
    emit(name: string, ...args: unknown[]) {
      listener[name]?.(...args)
    },
    avplay: {
      open(this: FakeAvplayHost, url: string) {
        this.calls.push(`open:${url}`)
        state = 'IDLE'
      },
      close(this: FakeAvplayHost) {
        this.calls.push('close')
        state = 'NONE'
      },
      stop(this: FakeAvplayHost) {
        this.calls.push('stop')
        state = 'IDLE'
      },
      setListener(next: Listener) {
        listener = next
      },
      setDisplayRect(this: FakeAvplayHost) {
        this.calls.push('displayRect')
      },
      prepareAsync(this: FakeAvplayHost, onSuccess: () => void) {
        this.calls.push('prepareAsync')
        state = 'READY'
        onSuccess()
      },
      play(this: FakeAvplayHost) {
        this.calls.push('play')
        state = 'PLAYING'
      },
      pause(this: FakeAvplayHost) {
        this.calls.push('pause')
        state = 'PAUSED'
      },
      seekTo(this: FakeAvplayHost, ms: number) {
        if (this.seekThrows > 0) {
          this.seekThrows -= 1
          const error = new Error('INVALID_STATE')
          error.name = 'InvalidStateError'
          throw error
        }
        this.calls.push(`seek:${ms}`)
      },
      getState: () => state,
      getCurrentTime: () => 42_000,
      getDuration: () => 3_600_000,
      setStreamingProperty(this: FakeAvplayHost, type: string, value: string) {
        this.streamingProps[type] = value
      },
    } as Record<string, unknown>,
  }
}

const directSource: StreamSource = { url: 'http://jf/stream.mp4', kind: 'direct' }
const hlsSource: StreamSource = { url: 'http://jf/master.m3u8', kind: 'hls' }

describe('AVPlayPlayer', () => {
  let fake: ReturnType<typeof fakeAvplay>

  beforeEach(() => {
    vi.useFakeTimers()
    fake = fakeAvplay()
    // rebind `this` for methods that push to fake.calls
    for (const key of Object.keys(fake.avplay)) {
      const value = fake.avplay[key]
      if (typeof value === 'function') {
        fake.avplay[key] = (value as (...a: unknown[]) => unknown).bind(fake)
      }
    }
    vi.stubGlobal('webapis', { avplay: fake.avplay })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function makePlayer() {
    const container = document.createElement('div')
    return { container, player: new AVPlayPlayer({ container, token: 't', serverUrl: 'http://jf' }) }
  }

  it('opens, prepares and plays a direct source, appending an avplayer object', async () => {
    const { container, player } = makePlayer()
    void player.load(directSource, {})
    // `load` awaits `prepare()` before calling `play()`; even though the fake
    // resolves synchronously, the `await` still defers to a microtask, so we
    // flush one tick before asserting on post-prepare effects.
    await Promise.resolve()
    expect(container.querySelector('object[type="application/avplayer"]')).not.toBeNull()
    expect(fake.calls).toContain('open:http://jf/stream.mp4')
    expect(fake.calls).toContain('prepareAsync')
    expect(fake.calls).toContain('play')
    expect(fake.streamingProps.USER_AGENT).toBeUndefined()
  })

  it('sets USER_AGENT and defers the resume seek for hls', async () => {
    const { player } = makePlayer()
    void player.load(hlsSource, { startSeconds: 30 })
    await Promise.resolve()
    expect(fake.streamingProps.USER_AGENT).toBe('Lolarr/0.1.0')
    expect(fake.calls).not.toContain('seek:30000')
    vi.advanceTimersByTime(1500)
    expect(fake.calls).toContain('seek:30000')
  })

  it('emits timeupdate on the 500ms poll and pause/playing on state changes', async () => {
    const { player } = makePlayer()
    const events: string[] = []
    player.on('timeupdate', () => events.push('timeupdate'))
    player.on('pause', () => events.push('pause'))
    await player.load(directSource, {})
    vi.advanceTimersByTime(500)
    expect(events).toContain('timeupdate')
    fake.setState('PAUSED')
    vi.advanceTimersByTime(500)
    expect(events).toContain('pause')
  })

  it('retries seekTo on INVALID_STATE', () => {
    const { player } = makePlayer()
    fake.seekThrows = 2
    player.seek(10)
    expect(fake.calls).not.toContain('seek:10000')
    vi.advanceTimersByTime(120)
    vi.advanceTimersByTime(120)
    expect(fake.calls).toContain('seek:10000')
  })

  it('maps onstreamcompleted to ended and onerror to error', async () => {
    const { player } = makePlayer()
    const events: string[] = []
    player.on('ended', () => events.push('ended'))
    player.on('error', () => events.push('error'))
    await player.load(directSource, {})
    fake.emit('onstreamcompleted')
    fake.emit('onerror', 'PLAYER_ERROR')
    expect(events).toEqual(['ended', 'error'])
  })

  it('suppresses error events after dispose and tears down', async () => {
    const { container, player } = makePlayer()
    const events: string[] = []
    player.on('error', () => events.push('error'))
    await player.load(directSource, {})
    player.dispose()
    fake.emit('onerror', 'PLAYER_ERROR')
    expect(events).toEqual([])
    expect(fake.calls).toContain('stop')
    expect(fake.calls).toContain('close')
    expect(container.querySelector('object')).toBeNull()
  })

  it('getPosition and getDuration convert ms to seconds', async () => {
    const { player } = makePlayer()
    await player.load(directSource, {})
    expect(player.getPosition()).toBe(42)
    expect(player.getDuration()).toBe(3600)
  })

  it('pauses when the app is hidden and resumes when visible again', async () => {
    const { player } = makePlayer()
    await player.load(directSource, {}) // state PLAYING
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(fake.calls).toContain('pause')
    fake.setState('PAUSED')
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(fake.calls.filter((call) => call === 'play')).toHaveLength(2)
  })
})
