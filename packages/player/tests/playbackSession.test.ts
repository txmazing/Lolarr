import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Player, PlayerEvent } from '../src/types.js'
import { createPlaybackSession, type PlaybackApi } from '../src/playbackSession.js'

const session = { url: 'http://jf.test', accessToken: 'tok', userId: 'u1', deviceId: 'dev1' }

function fakePlayer() {
  const handlers = new Map<PlayerEvent, Set<(detail?: unknown) => void>>()
  let position = 0
  const player: Player = {
    load: vi.fn().mockResolvedValue(undefined),
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn((seconds: number) => {
      position = seconds
    }),
    setVolume: vi.fn(),
    getPosition: () => position,
    getDuration: () => 3600,
    on: (event, handler) => {
      const set = handlers.get(event) ?? new Set()
      set.add(handler)
      handlers.set(event, set)
      return () => set.delete(handler)
    },
    dispose: vi.fn(),
  }
  return {
    player,
    emit(event: PlayerEvent, detail?: unknown) {
      for (const handler of handlers.get(event) ?? []) handler(detail)
    },
    setPosition(seconds: number) {
      position = seconds
    },
  }
}

function fakeApi(overrides: Partial<PlaybackApi> = {}): PlaybackApi {
  return {
    getPlaybackInfo: vi.fn().mockResolvedValue({
      playSessionId: 'ps1',
      mediaSources: [{ id: 'ms1', container: 'mkv', supportsDirectPlay: true, supportsDirectStream: false }],
    }),
    buildStreamSource: vi.fn().mockReturnValue({ kind: 'direct', url: 'http://jf.test/v' }),
    reportPlaybackStart: vi.fn().mockResolvedValue(undefined),
    reportPlaybackProgress: vi.fn().mockResolvedValue(undefined),
    reportPlaybackStopped: vi.fn().mockResolvedValue(undefined),
    stopActiveEncodings: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('createPlaybackSession', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts playback with resume position and reports start', async () => {
    const { player } = fakePlayer()
    const api = fakeApi()
    const states: string[] = []
    const handle = createPlaybackSession({
      session, player, itemId: 'i1', resumeTicks: 300_000_000,
      onStateChange: (s) => states.push(s), api, deviceProfile: {},
    })
    await handle.start()

    expect(api.getPlaybackInfo).toHaveBeenCalledWith(session, 'i1', expect.objectContaining({ startTimeTicks: 300_000_000 }))
    expect(player.load).toHaveBeenCalledWith({ kind: 'direct', url: 'http://jf.test/v' }, { startSeconds: 30 })
    expect(api.reportPlaybackStart).toHaveBeenCalledWith(session, expect.objectContaining({
      itemId: 'i1', playSessionId: 'ps1', playMethod: 'DirectPlay',
    }))
    expect(states).toContain('playing')
  })

  it('reports progress every 10 seconds and immediately on pause', async () => {
    const fake = fakePlayer()
    const api = fakeApi()
    const handle = createPlaybackSession({
      session, player: fake.player, itemId: 'i1',
      onStateChange: () => {}, api, deviceProfile: {},
    })
    await handle.start()

    fake.setPosition(15)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(api.reportPlaybackProgress).toHaveBeenCalledTimes(1)
    expect(api.reportPlaybackProgress).toHaveBeenLastCalledWith(session, expect.objectContaining({
      positionTicks: 150_000_000, isPaused: false,
    }))

    handle.togglePause()
    fake.emit('pause')
    expect(api.reportPlaybackProgress).toHaveBeenLastCalledWith(session, expect.objectContaining({ isPaused: true }))
  })

  it('reports progress immediately on resume', async () => {
    const fake = fakePlayer()
    const api = fakeApi()
    const handle = createPlaybackSession({
      session, player: fake.player, itemId: 'i1',
      onStateChange: () => {}, api, deviceProfile: {},
    })
    await handle.start()

    // Pause and clear the recorded calls
    handle.togglePause()
    fake.emit('pause')
    api.reportPlaybackProgress.mockClear()

    // Resume and emit playing event
    fake.setPosition(25)
    handle.togglePause()
    fake.emit('playing')

    expect(api.reportPlaybackProgress).toHaveBeenCalledWith(session, expect.objectContaining({
      positionTicks: 250_000_000, isPaused: false,
    }))
  })

  it('retries once with transcoding when direct play errors', async () => {
    const fake = fakePlayer()
    const getPlaybackInfo = vi
      .fn()
      .mockResolvedValueOnce({
        playSessionId: 'ps1',
        mediaSources: [{ id: 'ms1', container: 'mkv', supportsDirectPlay: true, supportsDirectStream: false }],
      })
      .mockResolvedValueOnce({
        playSessionId: 'ps2',
        mediaSources: [{ id: 'ms1', supportsDirectPlay: false, supportsDirectStream: true, transcodingUrl: '/t.m3u8' }],
      })
    const buildStreamSource = vi
      .fn()
      .mockReturnValueOnce({ kind: 'direct', url: 'http://jf.test/v' })
      .mockReturnValueOnce({ kind: 'hls', url: 'http://jf.test/t.m3u8' })
    const api = fakeApi({ getPlaybackInfo, buildStreamSource })
    const states: string[] = []
    const handle = createPlaybackSession({
      session, player: fake.player, itemId: 'i1',
      onStateChange: (s) => states.push(s), api, deviceProfile: {},
    })
    await handle.start()

    fake.emit('error')
    await vi.waitFor(() => {
      expect(getPlaybackInfo).toHaveBeenCalledTimes(2)
    })
    expect(getPlaybackInfo).toHaveBeenLastCalledWith(session, 'i1', expect.objectContaining({ enableDirectPlay: false }))

    // zweiter Fehler (jetzt hls) → error state, KEIN dritter Versuch
    fake.emit('error')
    await vi.waitFor(() => {
      expect(states).toContain('error')
    })
    expect(getPlaybackInfo).toHaveBeenCalledTimes(2)
  })

  it('stops reporting, sends stopped and kills encodings only for hls', async () => {
    const fake = fakePlayer()
    const api = fakeApi({
      buildStreamSource: vi.fn().mockReturnValue({ kind: 'hls', url: 'http://jf.test/t.m3u8' }),
      getPlaybackInfo: vi.fn().mockResolvedValue({
        playSessionId: 'ps1',
        mediaSources: [{ id: 'ms1', supportsDirectPlay: false, supportsDirectStream: true, transcodingUrl: '/t.m3u8' }],
      }),
    })
    const handle = createPlaybackSession({
      session, player: fake.player, itemId: 'i1',
      onStateChange: () => {}, api, deviceProfile: {},
    })
    await handle.start()
    await handle.stop()

    expect(api.reportPlaybackStopped).toHaveBeenCalled()
    expect(api.stopActiveEncodings).toHaveBeenCalledWith(session, 'ps1')
    expect(fake.player.dispose).toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(30_000)
    expect(api.reportPlaybackProgress).not.toHaveBeenCalled()
  })

  it('enters error state when nothing is playable', async () => {
    const api = fakeApi({ buildStreamSource: vi.fn().mockReturnValue(null) })
    const states: string[] = []
    const handle = createPlaybackSession({
      session, player: fakePlayer().player, itemId: 'i1',
      onStateChange: (s) => states.push(s), api, deviceProfile: {},
    })
    await handle.start()
    expect(states).toContain('error')
  })
})
