# Lolarr Slice 5: Tizen-TV-Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filme/Episoden auf Samsung-Tizen-TVs über die native AVPlay-API spielen, gesteuert per Fernbedienung — bei voller Wiederverwendung der Session-Orchestrierung aus Slice 3.

**Architecture:** Ein injiziertes `PlayerPlatform`-Objekt (`createPlayer`/`buildDeviceProfile`/`supportsVolume`/`registerMediaKeys`) ersetzt die hartkodierte `WebPlayer`-Kopplung. Der Player besitzt fortan sein eigenes DOM-Element (Web: `<video>`, Tizen: `<object type="application/avplayer">`); `PlayerScreen` rendert nur noch einen leeren Container-`<div>`. `apps/web` liefert `webPlatform`, `apps/tv` liefert `tizenPlatform` (AVPlayPlayer + Tizen-DeviceProfile + Media-Keys).

**Tech Stack:** Samsung `webapis.avplay` + `tizen.tvinputdevice`/`tizen.systeminfo` (ambient-getypt, in Tests gestubbt), React 19, Vitest (fake timers, gestubbte Globals).

**Spec:** `docs/superpowers/specs/2026-07-04-lolarr-tizen-playback-design.md` — bei Widerspruch gewinnt die Spec.

## Global Constraints

- `PlayerPlatform`-Signatur exakt: `{ createPlayer(host: PlayerHost): Player; buildDeviceProfile(): DeviceProfile; supportsVolume: boolean; registerMediaKeys?(): () => void }`, `PlayerHost = { container: HTMLElement; token: string; serverUrl: string }`.
- AVPlay-Zeiten sind **Millisekunden**; das `Player`-Interface arbeitet in **Sekunden** (Umrechnung nur im AVPlayPlayer: getPosition/getDuration `/1000`, seek `*1000`). Ticks-Umrechnung bleibt ausschließlich in `createPlaybackSession` (1 s = 10_000_000).
- `webapis`/`tizen` werden NIE statisch importiert — ausschließlich über die Ambient-Deklaration in `packages/player/src/tizen.d.ts` referenziert. Tizen-Module (`avplayPlayer`, `tizenDeviceProfile`, `tizenPlatform`) dürfen KEINE Modul-Ebenen-Seiteneffekte haben (nur Klassen-/Funktions-Deklarationen), damit sie im Web-Bundle tree-shakebar sind und beim bloßen Import nie `webapis` anfassen.
- AVPlay-Regeln (aus Recherche, verifiziert an Moonfin-Quellcode): `oncurrentplaytime` ist unzuverlässig → `timeupdate` per 500-ms-Polling von `getState()`+`getCurrentTime()`; HLS-Resume-Seek erst ~1500 ms nach `play()`; `seekTo` in Retry-Loop (≤ 8×, 120 ms) gegen `INVALID_STATE`; bei HLS `setStreamingProperty('USER_AGENT', …)` mit `'USERAGENT'`-Fallback; `prepareAsync` mit 60-s-Timeout; kein Volume-API (setVolume = No-op).
- Back-Taste (Keycode 10009) im Player: Controls sichtbar → ausblenden; sonst `onExit()`. Media-Keys additiv zu den Slice-3-Desktop-Keys (Space/Pfeile/F/Escape).
- Tizen-DeviceProfile `Name: 'Lolarr Tizen'`; DTS/DCA IMMER ausgeschlossen (überall unsupported → Transcode); hevc/vp9/av1 nur im `mp4,mkv,ts`-Container-Profil.
- Repo-Regeln: erasableSyntaxOnly (keine TS-Parameter-Properties), ESM `.js`-Imports in packages, `react-refresh`-Lint (begründete disables OK), UI-Texte englisch, Conventional Commits englisch.
- Nach jedem Task: `pnpm test && pnpm typecheck` grün (Frontend-Tasks zusätzlich `pnpm lint` + `pnpm --filter @lolarr/web build && pnpm --filter @lolarr/tv build`).
- On-Device-Verifikation bleibt manuell (kein Tizen-Emulator in der CI) — im finalen Task dokumentiert.

---

### Task 1: PlayerPlatform-Typen + webPlatform + WebPlayer-Cleanup-Hook

**Files:**
- Modify: `packages/player/src/types.ts` (PlayerHost, PlayerPlatform)
- Modify: `packages/player/src/webPlayer.ts` (optionaler `onDispose`-Hook)
- Create: `packages/player/src/webPlatform.ts`
- Modify: `packages/player/src/index.ts` (Exporte)
- Test: `packages/player/tests/webPlatform.test.ts`

**Interfaces:**
- Produces: `PlayerHost`, `PlayerPlatform` (Typen); `webPlatform: PlayerPlatform`; `WebPlayer` konstruiert weiterhin mit `(video: HTMLVideoElement, onDispose?: () => void)`.

- [ ] **Step 1: Typen ergänzen** — `packages/player/src/types.ts`, ans Ende anhängen:

```ts
export type PlayerHost = { container: HTMLElement; token: string; serverUrl: string }

export type DeviceProfileValue = import('./deviceProfile.js').DeviceProfile

export type PlayerPlatform = {
  createPlayer(host: PlayerHost): Player
  buildDeviceProfile(): DeviceProfileValue
  supportsVolume: boolean
  registerMediaKeys?(): () => void
}
```

- [ ] **Step 2: WebPlayer-Cleanup-Hook** — `packages/player/src/webPlayer.ts`:

Konstruktor + Feld ergänzen (explizite Feld-Deklaration, keine Parameter-Property):
```ts
  private readonly onDispose: (() => void) | undefined

  constructor(video: HTMLVideoElement, onDispose?: () => void) {
    this.video = video
    this.onDispose = onDispose
    for (const [domEvent, playerEvent] of VIDEO_EVENT_MAP) {
      const listener = () => this.emit(playerEvent)
      video.addEventListener(domEvent, listener)
      this.domCleanups.push(() => video.removeEventListener(domEvent, listener))
    }
  }
```
In `dispose()` am Ende ergänzen (nach `this.video.load()`):
```ts
    this.onDispose?.()
```

- [ ] **Step 3: jsdom bereitstellen** — Das player-Paket testet bislang nur in der node-Umgebung (kein `document`). Die neuen DOM-Tests (dieser Task + Task 2) brauchen jsdom: `pnpm --filter @lolarr/player add -D jsdom` (danach ist es installiert und im Lockfile). Die Umgebung wird **pro Datei** per Docblock aktiviert (nur DOM-Tests zahlen die Kosten; `deviceProfile`/`playbackSession`/`tizenDeviceProfile`/`tizenPlatform` bleiben node).

- [ ] **Step 4: Failing Test** — `packages/player/tests/webPlatform.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { webPlatform } from '../src/webPlatform.js'

describe('webPlatform', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('supports volume and has no media-key registration', () => {
    expect(webPlatform.supportsVolume).toBe(true)
    expect(webPlatform.registerMediaKeys).toBeUndefined()
  })

  it('creates a video element inside the host container and removes it on dispose', () => {
    const container = document.createElement('div')
    const player = webPlatform.createPlayer({ container, token: 't', serverUrl: 'http://jf' })
    const video = container.querySelector('video')
    expect(video).not.toBeNull()
    player.dispose()
    expect(container.querySelector('video')).toBeNull()
  })

  it('builds a device profile named Lolarr Web', () => {
    expect(webPlatform.buildDeviceProfile().Name).toBe('Lolarr Web')
  })
})
```

- [ ] **Step 5: Rot** — `pnpm --filter @lolarr/player test tests/webPlatform.test.ts` → FAIL (Modul fehlt).

- [ ] **Step 6: Implementieren** — `packages/player/src/webPlatform.ts`:

```ts
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
```

`packages/player/src/index.ts` — Exporte ergänzen:
```ts
export { webPlatform } from './webPlatform.js'
export type { PlayerHost, PlayerPlatform } from './types.js'
```

- [ ] **Step 7: Grün** — `pnpm --filter @lolarr/player test tests/webPlatform.test.ts` → PASS, dann `pnpm test && pnpm typecheck` → PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/player pnpm-lock.yaml
git commit -m "feat: player platform seam with web platform factory"
```

---

### Task 2: Ambient-Typen + AVPlayPlayer

**Files:**
- Create: `packages/player/src/tizen.d.ts` (ambient `webapis`/`tizen`)
- Create: `packages/player/src/avplayPlayer.ts`
- Modify: `packages/player/src/index.ts` (Export `AVPlayPlayer`)
- Test: `packages/player/tests/avplayPlayer.test.ts`

**Interfaces:**
- Consumes: `Player`, `PlayerHost` (Task 1), `StreamSource` (`@lolarr/jellyfin`).
- Produces: `class AVPlayPlayer implements Player` (Konstruktor `(host: PlayerHost)`). Ambient global `webapis` (avplay + productinfo) und `tizen` (tvinputdevice + systeminfo).

- [ ] **Step 1: Ambient-Deklaration** — `packages/player/src/tizen.d.ts`:

```ts
export {}

declare global {
  type AVPlayState = 'NONE' | 'IDLE' | 'READY' | 'PLAYING' | 'PAUSED'

  interface AVPlayListener {
    onbufferingstart?: () => void
    onbufferingprogress?: (percent: number) => void
    onbufferingcomplete?: () => void
    oncurrentplaytime?: (currentTime: number) => void
    onstreamcompleted?: () => void
    onevent?: (eventType: string, eventData: string) => void
    onerror?: (eventType: string) => void
    onerrormsg?: (eventType: string, errorMsg: string) => void
  }

  interface AVPlay {
    open(url: string): void
    close(): void
    stop(): void
    setListener(listener: AVPlayListener): void
    setDisplayRect(x: number, y: number, width: number, height: number): void
    prepareAsync(onSuccess: () => void, onError: (error?: unknown) => void): void
    play(): void
    pause(): void
    seekTo(ms: number, onSuccess?: () => void, onError?: (error?: unknown) => void): void
    getState(): AVPlayState
    getCurrentTime(): number
    getDuration(): number
    setStreamingProperty(type: string, value: string): void
  }

  interface ProductInfo {
    getRealModel(): string
    getFirmware(): string
  }

  interface TvInputDeviceKey {
    name: string
    code: number
  }

  interface TvInputDevice {
    getSupportedKeys(): TvInputDeviceKey[]
    registerKey(name: string): void
    unregisterKey(name: string): void
  }

  interface TizenSystemInfo {
    getCapability(key: string): string
  }

  const webapis: { avplay: AVPlay; productinfo: ProductInfo }
  const tizen: { tvinputdevice: TvInputDevice; systeminfo: TizenSystemInfo }
}
```

- [ ] **Step 2: Failing Test** — `packages/player/tests/avplayPlayer.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StreamSource } from '@lolarr/jellyfin'
import { AVPlayPlayer } from '../src/avplayPlayer.js'

type Listener = Record<string, ((...args: unknown[]) => void) | undefined>

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
      open(url: string) {
        this.calls.push(`open:${url}`)
        state = 'IDLE'
      },
      close() {
        this.calls.push('close')
        state = 'NONE'
      },
      stop() {
        this.calls.push('stop')
        state = 'IDLE'
      },
      setListener(next: Listener) {
        listener = next
      },
      setDisplayRect() {
        this.calls.push('displayRect')
      },
      prepareAsync(onSuccess: () => void) {
        this.calls.push('prepareAsync')
        state = 'READY'
        onSuccess()
      },
      play() {
        this.calls.push('play')
        state = 'PLAYING'
      },
      pause() {
        this.calls.push('pause')
        state = 'PAUSED'
      },
      seekTo(ms: number) {
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
      setStreamingProperty(type: string, value: string) {
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

  it('opens, prepares and plays a direct source, appending an avplayer object', () => {
    const { container, player } = makePlayer()
    void player.load(directSource, {})
    expect(container.querySelector('object[type="application/avplayer"]')).not.toBeNull()
    expect(fake.calls).toContain('open:http://jf/stream.mp4')
    expect(fake.calls).toContain('prepareAsync')
    expect(fake.calls).toContain('play')
    expect(fake.streamingProps.USER_AGENT).toBeUndefined()
  })

  it('sets USER_AGENT and defers the resume seek for hls', () => {
    const { player } = makePlayer()
    void player.load(hlsSource, { startSeconds: 30 })
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
```

- [ ] **Step 3: Rot** — `pnpm --filter @lolarr/player test tests/avplayPlayer.test.ts` → FAIL (Modul fehlt).

- [ ] **Step 4: Implementieren** — `packages/player/src/avplayPlayer.ts`:

```ts
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
  private lastPaused = true
  private stopped = false
  private wasPlayingBeforeHidden = false

  constructor(host: PlayerHost) {
    this.element = document.createElement('object')
    this.element.type = 'application/avplayer'
    this.element.className = 'avplay-surface'
    host.container.appendChild(this.element)
    webapis.avplay.setDisplayRect(0, 0, 1920, 1080)
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
    webapis.avplay.open(source.url)
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
        webapis.avplay.setStreamingProperty('USERAGENT', USER_AGENT)
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
        setTimeout(() => this.seek(startSeconds), HLS_RESUME_SEEK_DELAY_MS)
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
    const state = webapis.avplay.getState()
    if (state === 'PAUSED' || state === 'READY') {
      webapis.avplay.play()
    }
  }

  pause() {
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
    try {
      webapis.avplay.seekTo(ms)
    } catch (error) {
      if (attempt < SEEK_RETRY_LIMIT && isInvalidState(error)) {
        setTimeout(() => this.seekWithRetry(ms, attempt + 1), SEEK_RETRY_DELAY_MS)
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
    if (!this.stopped) {
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
```

`packages/player/src/index.ts` — Export ergänzen:
```ts
export { AVPlayPlayer } from './avplayPlayer.js'
```

- [ ] **Step 5: Grün** — `pnpm --filter @lolarr/player test tests/avplayPlayer.test.ts` → PASS, dann `pnpm test && pnpm typecheck` → PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/player
git commit -m "feat: avplay player adapter for tizen"
```

---

### Task 3: Tizen-DeviceProfile mit Versions-Detection

**Files:**
- Create: `packages/player/src/tizenDeviceProfile.ts`
- Modify: `packages/player/src/index.ts` (Exporte)
- Test: `packages/player/tests/tizenDeviceProfile.test.ts`

**Interfaces:**
- Consumes: `DeviceProfile` (`./deviceProfile.js`).
- Produces: `type TizenInfoSource = { platformVersion(): string | undefined; model(): string | undefined; firmware(): string | undefined }`; `detectTizenYear(source: TizenInfoSource): number`; `buildTizenDeviceProfile(source?: TizenInfoSource): DeviceProfile`.

- [ ] **Step 1: Failing Test** — `packages/player/tests/tizenDeviceProfile.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildTizenDeviceProfile, detectTizenYear } from '../src/tizenDeviceProfile.js'

function source(overrides: Partial<{ platformVersion: string; model: string; firmware: string }>) {
  return {
    platformVersion: () => overrides.platformVersion,
    model: () => overrides.model,
    firmware: () => overrides.firmware,
  }
}

describe('detectTizenYear', () => {
  it('prefers the platform version', () => {
    expect(detectTizenYear(source({ platformVersion: '6.0' }))).toBe(2021)
  })

  it('falls back to the model year letter', () => {
    expect(detectTizenYear(source({ model: 'UN55RU8000' }))).toBe(2019)
  })

  it('falls back to a firmware year', () => {
    expect(detectTizenYear(source({ firmware: 'T-KTMAKUC-2024.1' }))).toBe(2024)
  })

  it('uses the conservative default when nothing is known', () => {
    expect(detectTizenYear(source({}))).toBe(2018)
  })
})

describe('buildTizenDeviceProfile', () => {
  it('names the profile and gates hevc to mp4/mkv/ts, never DTS', () => {
    const profile = buildTizenDeviceProfile(source({ platformVersion: '5.0' })) // 2019
    expect(profile.Name).toBe('Lolarr Tizen')
    const videoProfiles = profile.DirectPlayProfiles as Array<{ Container: string; VideoCodec?: string; AudioCodec?: string }>
    const hevcProfile = videoProfiles.find((entry) => entry.VideoCodec?.includes('hevc'))
    expect(hevcProfile?.Container).toBe('mp4,mkv,ts')
    const legacyProfile = videoProfiles.find((entry) => entry.Container === 'm4v,mov,avi')
    expect(legacyProfile?.VideoCodec).toBe('h264')
    for (const entry of videoProfiles) {
      expect(entry.AudioCodec ?? '').not.toMatch(/dts|dca/i)
    }
  })

  it('adds av1 and truehd on newer years', () => {
    const profile = buildTizenDeviceProfile(source({ platformVersion: '6.5' })) // 2022
    const videoProfiles = profile.DirectPlayProfiles as Array<{ Container: string; VideoCodec?: string; AudioCodec?: string }>
    const rich = videoProfiles.find((entry) => entry.Container === 'mp4,mkv,ts')
    expect(rich?.VideoCodec).toContain('av1')
    expect(rich?.AudioCodec).toContain('truehd')
  })
})
```

- [ ] **Step 2: Rot** — `pnpm --filter @lolarr/player test tests/tizenDeviceProfile.test.ts` → FAIL (Modul fehlt).

- [ ] **Step 3: Implementieren** — `packages/player/src/tizenDeviceProfile.ts`:

```ts
import type { DeviceProfile } from './deviceProfile.js'

export type TizenInfoSource = {
  platformVersion(): string | undefined
  model(): string | undefined
  firmware(): string | undefined
}

const DEFAULT_YEAR = 2018

const VERSION_YEAR: Record<string, number> = {
  '2.3': 2015,
  '2.4': 2016,
  '3.0': 2017,
  '4.0': 2018,
  '5.0': 2019,
  '5.5': 2020,
  '6.0': 2021,
  '6.5': 2022,
  '7.0': 2023,
  '8.0': 2024,
}

const MODEL_YEAR: Record<string, number> = {
  J: 2015,
  K: 2016,
  M: 2017,
  N: 2018,
  R: 2019,
  T: 2020,
  A: 2021,
  B: 2022,
  C: 2023,
  D: 2024,
  E: 2025,
  F: 2026,
}

export function detectTizenYear(source: TizenInfoSource): number {
  return (
    yearFromVersion(source.platformVersion()) ??
    yearFromModel(source.model()) ??
    yearFromFirmware(source.firmware()) ??
    DEFAULT_YEAR
  )
}

export function buildTizenDeviceProfile(source: TizenInfoSource = defaultInfoSource()): DeviceProfile {
  const year = detectTizenYear(source)
  const videoCodecs = videoCodecsForYear(year)
  const audioCodecs = audioCodecsForYear(year)

  return {
    Name: 'Lolarr Tizen',
    MaxStreamingBitrate: 120_000_000,
    DirectPlayProfiles: [
      { Container: 'mp4,mkv,ts', Type: 'Video', VideoCodec: videoCodecs.join(','), AudioCodec: audioCodecs.join(',') },
      { Container: 'm4v,mov,avi', Type: 'Video', VideoCodec: 'h264', AudioCodec: audioCodecs.join(',') },
      { Container: 'webm', Type: 'Video', VideoCodec: year >= 2018 ? 'vp9,vp8' : 'vp8', AudioCodec: 'vorbis,opus' },
      { Container: 'mp3,aac,m4a,flac,ogg,wav', Type: 'Audio' },
    ],
    TranscodingProfiles: [
      {
        Container: 'ts',
        Type: 'Video',
        Protocol: 'hls',
        VideoCodec: 'h264',
        AudioCodec: 'aac',
        Context: 'Streaming',
        MaxAudioChannels: '2',
        MinSegments: 1,
        BreakOnNonKeyFrames: true,
      },
    ],
    SubtitleProfiles: [],
    CodecProfiles: [],
    ResponseProfiles: [],
  }
}

function videoCodecsForYear(year: number): string[] {
  const codecs = ['h264', 'hevc']
  if (year >= 2018) {
    codecs.push('vp9')
  }
  if (year >= 2020) {
    codecs.push('av1')
  }
  return codecs
}

function audioCodecsForYear(year: number): string[] {
  // DTS/DCA is intentionally excluded: unsupported on every Tizen TV year.
  const codecs = ['aac', 'mp3', 'flac', 'vorbis', 'pcm', 'ac3', 'eac3']
  if (year >= 2018) {
    codecs.push('opus')
  }
  if (year >= 2020) {
    codecs.push('truehd')
  }
  return codecs
}

function yearFromVersion(version: string | undefined): number | undefined {
  if (!version) {
    return undefined
  }
  const match = version.match(/^\d+\.\d+/)
  return match ? VERSION_YEAR[match[0]] : undefined
}

function yearFromModel(model: string | undefined): number | undefined {
  if (!model) {
    return undefined
  }
  const match = model.match(/\d{2}([A-Z])/)
  return match ? MODEL_YEAR[match[1]] : undefined
}

function yearFromFirmware(firmware: string | undefined): number | undefined {
  if (!firmware) {
    return undefined
  }
  const match = firmware.match(/(20\d{2})/)
  if (!match) {
    return undefined
  }
  const year = Number.parseInt(match[1], 10)
  return year >= 2015 && year <= 2035 ? year : undefined
}

function defaultInfoSource(): TizenInfoSource {
  return {
    platformVersion: () => safe(() => tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version')),
    model: () => safe(() => webapis.productinfo.getRealModel()),
    firmware: () => safe(() => webapis.productinfo.getFirmware()),
  }
}

function safe(read: () => string): string | undefined {
  try {
    const value = read()
    return value.length > 0 ? value : undefined
  } catch {
    return undefined
  }
}
```

`packages/player/src/index.ts` — Exporte ergänzen:
```ts
export { buildTizenDeviceProfile, detectTizenYear, type TizenInfoSource } from './tizenDeviceProfile.js'
```

- [ ] **Step 4: Grün** — `pnpm --filter @lolarr/player test tests/tizenDeviceProfile.test.ts` → PASS, dann `pnpm test && pnpm typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/player
git commit -m "feat: tizen device profile with year detection"
```

---

### Task 4: tizenPlatform-Factory + Media-Key-Registrierung

**Files:**
- Create: `packages/player/src/tizenPlatform.ts`
- Modify: `packages/player/src/index.ts` (Export `tizenPlatform`)
- Test: `packages/player/tests/tizenPlatform.test.ts`

**Interfaces:**
- Consumes: `AVPlayPlayer` (Task 2), `buildTizenDeviceProfile` (Task 3), `PlayerPlatform`/`PlayerHost` (Task 1).
- Produces: `tizenPlatform: PlayerPlatform` (`supportsVolume: false`, `registerMediaKeys` vorhanden).

- [ ] **Step 1: Failing Test** — `packages/player/tests/tizenPlatform.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { tizenPlatform } from '../src/tizenPlatform.js'

describe('tizenPlatform', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('does not support volume and exposes media-key registration', () => {
    expect(tizenPlatform.supportsVolume).toBe(false)
    expect(typeof tizenPlatform.registerMediaKeys).toBe('function')
  })

  it('registers only supported media keys and unregisters them on cleanup', () => {
    const registered: string[] = []
    const unregistered: string[] = []
    vi.stubGlobal('tizen', {
      tvinputdevice: {
        getSupportedKeys: () => [
          { name: 'MediaPlay', code: 415 },
          { name: 'MediaPause', code: 19 },
          { name: 'MediaPlayPause', code: 10252 },
          { name: 'MediaStop', code: 413 },
          { name: 'MediaRewind', code: 412 },
          { name: 'MediaFastForward', code: 417 },
        ],
        registerKey: (name: string) => registered.push(name),
        unregisterKey: (name: string) => unregistered.push(name),
      },
    })

    const cleanup = tizenPlatform.registerMediaKeys!()
    expect(registered).toEqual([
      'MediaPlay',
      'MediaPause',
      'MediaPlayPause',
      'MediaStop',
      'MediaRewind',
      'MediaFastForward',
    ])
    cleanup()
    expect(unregistered).toEqual(registered)
  })

  it('skips keys the firmware does not support', () => {
    const registered: string[] = []
    vi.stubGlobal('tizen', {
      tvinputdevice: {
        getSupportedKeys: () => [{ name: 'MediaPlay', code: 415 }],
        registerKey: (name: string) => registered.push(name),
        unregisterKey: () => {},
      },
    })
    tizenPlatform.registerMediaKeys!()
    expect(registered).toEqual(['MediaPlay'])
  })
})
```

- [ ] **Step 2: Rot** — `pnpm --filter @lolarr/player test tests/tizenPlatform.test.ts` → FAIL (Modul fehlt).

- [ ] **Step 3: Implementieren** — `packages/player/src/tizenPlatform.ts`:

```ts
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
```

`packages/player/src/index.ts` — Export ergänzen:
```ts
export { tizenPlatform } from './tizenPlatform.js'
```

- [ ] **Step 4: Grün** — `pnpm --filter @lolarr/player test tests/tizenPlatform.test.ts` → PASS, dann `pnpm test && pnpm typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/player
git commit -m "feat: tizen platform factory with media key registration"
```

---

### Task 5: Frontend-Naht — usePlaybackSession/PlayerScreen/PlayerControls + Prop-Durchreichung

**Files:**
- Modify: `packages/features/src/player/usePlaybackSession.ts` (Container statt Video, `platform`-Param)
- Modify: `packages/features/src/player/PlayerScreen.tsx` (Container-`<div>`, `platform`+`showVolume`, Tizen-Keycodes, Back-Kaskade)
- Modify: `packages/ui/src/components/PlayerControls.tsx` (`showVolume`-Prop)
- Modify: `packages/features/src/app.tsx` (`playerPlatform`-Prop, Default `webPlatform`)
- Modify: `packages/features/src/experience.tsx` (`playerPlatform` durchreichen)
- Modify: `packages/features/src/index.tsx` (kein Export-Change nötig; nur prüfen)
- Test: `packages/features/tests/store.test.ts` (unverändert lassen), `packages/ui/tests/playerControls.test.ts` (neu)

**Interfaces:**
- Consumes: `PlayerPlatform`, `webPlatform` (`@lolarr/player`).
- Produces: `usePlaybackSession({ storage, platform, itemId, resumeTicks })` → `{ containerRef, state, errorMessage, handle }`; `LolarrAppProps` + `playerPlatform?: PlayerPlatform`; `PlayerControls` + `showVolume: boolean`.

- [ ] **Step 1: PlayerControls-`showVolume`** — Failing Test `packages/ui/tests/playerControls.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PlayerControls } from '../src/components/PlayerControls.js'
import { DefaultAction } from '../src/components/DefaultAction.js'

function markup(showVolume: boolean) {
  return renderToStaticMarkup(
    <PlayerControls
      Action={DefaultAction}
      visible
      isPaused={false}
      position={0}
      duration={100}
      volume={1}
      showVolume={showVolume}
      onTogglePause={() => {}}
      onSeekTo={() => {}}
      onSeekBy={() => {}}
      onVolume={() => {}}
      onFullscreen={() => {}}
      onBack={() => {}}
    />,
  )
}

describe('PlayerControls showVolume', () => {
  it('renders the volume slider when showVolume is true', () => {
    expect(markup(true)).toContain('player-volume')
  })

  it('omits the volume slider when showVolume is false', () => {
    expect(markup(false)).not.toContain('player-volume')
  })
})
```

Prüfe zuerst, ob `react-dom` als devDependency in `packages/ui` vorhanden ist; falls nicht: `pnpm --filter @lolarr/ui add -D react-dom` (React 19 ist bereits Peer). Der Test nutzt `renderToStaticMarkup` (kein DOM nötig). Falls die ui-vitest-Umgebung JSX in `.ts`-Tests nicht erlaubt, Datei als `.tsx` anlegen (`packages/ui/tests/playerControls.test.tsx`) und `vitest.config.ts` `include` entsprechend erweitern.

- [ ] **Step 2: Rot** — `pnpm --filter @lolarr/ui test` → FAIL (`showVolume` unbekannt / Slider immer da).

- [ ] **Step 3: PlayerControls implementieren** — `packages/ui/src/components/PlayerControls.tsx`:

`PlayerControlsProps` um `showVolume: boolean` ergänzen (nach `volume: number`), im Destructuring aufnehmen, und den Volume-`<input>` (Block `className="player-volume"`) in eine Bedingung setzen:
```tsx
          {showVolume ? (
            <input
              className="player-volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(event) => onVolume(Number(event.currentTarget.value))}
              aria-label="Volume"
            />
          ) : null}
```

- [ ] **Step 4: usePlaybackSession umbauen** — `packages/features/src/player/usePlaybackSession.ts` komplett ersetzen:

```ts
import { useEffect, useRef, useState } from 'react'
import { readJellyfinSession } from '@lolarr/jellyfin'
import {
  createPlaybackSession,
  type PlaybackSessionHandle,
  type PlaybackSessionState,
  type PlayerPlatform,
} from '@lolarr/player'
import type { KeyValueStorage } from '../storage.js'

export function usePlaybackSession({
  storage,
  platform,
  itemId,
  resumeTicks,
}: {
  storage: KeyValueStorage
  platform: PlayerPlatform
  itemId: string
  resumeTicks?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<PlaybackSessionHandle | null>(null)
  const [state, setState] = useState<PlaybackSessionState>('loading')
  const [errorMessage, setErrorMessage] = useState<string>()

  useEffect(() => {
    const jellyfinSession = readJellyfinSession(storage)
    const container = containerRef.current
    if (!jellyfinSession || !container) {
      setState('error')
      setErrorMessage(jellyfinSession ? 'Player unavailable' : 'Session missing — please sign in again')
      return
    }

    const player = platform.createPlayer({
      container,
      token: jellyfinSession.accessToken,
      serverUrl: jellyfinSession.url,
    })
    const handle = createPlaybackSession({
      session: jellyfinSession,
      player,
      itemId,
      resumeTicks,
      deviceProfile: platform.buildDeviceProfile(),
      onStateChange: (nextState, detail) => {
        setState(nextState)
        if (detail?.message) {
          setErrorMessage(detail.message)
        }
      },
    })
    handleRef.current = handle
    void handle.start()

    return () => {
      handleRef.current = null
      void handle.stop()
    }
  }, [storage, platform, itemId, resumeTicks])

  return { containerRef, state, errorMessage, handle: handleRef }
}
```

- [ ] **Step 5: PlayerScreen umbauen** — `packages/features/src/player/PlayerScreen.tsx`:

Signatur um `platform: PlayerPlatform` erweitern (Import `import type { PlaybackSessionHandle, PlayerPlatform } from '@lolarr/player'`). `usePlaybackSession`-Aufruf um `platform` ergänzen; `videoRef` → `containerRef` aus dem Hook.

Media-Keys + Back-Kaskade. `PlaybackSessionHandle` hat nur `togglePause` (kein getrenntes play/pause); MediaPlay/MediaPause wirken deshalb deterministisch über den `state` (`'paused'` vs. sonst), nicht toggelnd. Die Back-Kaskade liest die Controls-Sichtbarkeit aus einem Ref, damit der Effekt nicht bei jedem Sichtbarkeitswechsel neu bindet.

Nach `const [controlsVisible, setControlsVisible] = useState(true)` ergänzen:
```tsx
  const controlsVisibleRef = useRef(true)
  useEffect(() => {
    controlsVisibleRef.current = controlsVisible
  }, [controlsVisible])
```

Den bestehenden `keydown`-`useEffect` komplett durch diese Fassung ersetzen:
```tsx
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      showControls()
      if (event.key === ' ' || event.keyCode === 10252) {
        event.preventDefault()
        handle.current?.togglePause()
      } else if (event.keyCode === 415) {
        if (state === 'paused') {
          handle.current?.togglePause() // MediaPlay
        }
      } else if (event.keyCode === 19) {
        if (state !== 'paused') {
          handle.current?.togglePause() // MediaPause
        }
      } else if (event.key === 'ArrowLeft' || event.keyCode === 412) {
        handle.current?.seekBy(-10)
      } else if (event.key === 'ArrowRight' || event.keyCode === 417) {
        handle.current?.seekBy(10)
      } else if (event.keyCode === 413) {
        onExit() // MediaStop
      } else if (event.key === 'f' || event.key === 'F') {
        toggleFullscreen()
      } else if (event.key === 'Escape' || event.keyCode === 10009) {
        if (event.key === 'Escape' && document.fullscreenElement) {
          return
        }
        if (controlsVisibleRef.current) {
          setControlsVisible(false)
          return
        }
        onExit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showControls, onExit, handle, state])
```

Media-Key-Registrierung beim Mount:
```tsx
  useEffect(() => {
    const unregister = platform.registerMediaKeys?.()
    return () => unregister?.()
  }, [platform])
```

Ref-Umstellung: Die alte lokale Deklaration `const containerRef = useRef<HTMLDivElement>(null)` **entfernen** — `containerRef` kommt jetzt aus `usePlaybackSession` und referenziert die Player-Surface. Für den Fullscreen-Container ein separates `const screenRef = useRef<HTMLDivElement>(null)` einführen; `toggleFullscreen` nutzt `screenRef.current?.requestFullscreen()` (statt `containerRef`). Return-JSX:
```tsx
  return (
    <div ref={screenRef} className="player-screen" onMouseMove={showControls}>
      <div ref={containerRef} className="player-surface" />
      {state === 'loading' ? <div className="player-spinner" aria-label="Loading" /> : null}
      <PlayerControlsContainer
        Action={Action}
        visible={controlsVisible}
        isPaused={state === 'paused'}
        title={title}
        handle={handle}
        showVolume={platform.supportsVolume}
        onFullscreen={toggleFullscreen}
        onBack={onExit}
      />
      {state === 'ended' && seriesId ? (
        <AutoplayNext … unverändert … />
      ) : null}
    </div>
  )
```

`PlayerControlsContainer` anpassen: `videoRef`-Prop entfernen, `showVolume: boolean`-Prop ergänzen; der `onVolume`-Handler ruft jetzt `handle.current?.setVolume?.(value)` statt `videoRef.current.volume`. Da `PlaybackSessionHandle` kein `setVolume` hat, wird die Lautstärke über den Player gesetzt — führe dazu eine Handle-Methode ein: in `createPlaybackSession` (`packages/player/src/playbackSession.ts`) das Rückgabeobjekt um
```ts
    setVolume(volume: number) {
      player.setVolume(volume)
    },
```
ergänzen und den Typ `PlaybackSessionHandle` um `setVolume(volume: number): void`. `PlayerControlsContainer.onVolume`:
```tsx
      onVolume={(value) => {
        setVolume(value)
        handle.current?.setVolume(value)
      }}
```
`showVolume` an `PlayerControls` durchreichen.

- [ ] **Step 6: Prop-Durchreichung** — `packages/features/src/app.tsx`: `LolarrAppProps` um `playerPlatform?: PlayerPlatform` (Import `import { webPlatform, type PlayerPlatform } from '@lolarr/player'`); Default `playerPlatform = webPlatform`; durch `LolarrExperience` → `AuthenticatedExperience` reichen. `packages/features/src/experience.tsx`: `AuthenticatedExperience`-Props um `playerPlatform: PlayerPlatform`; im `player`-Branch an `PlayerScreen` weitergeben (`platform={playerPlatform}`).

- [ ] **Step 7: Grün + Gates** — `pnpm --filter @lolarr/ui test` → PASS; dann `pnpm test && pnpm typecheck && pnpm lint && pnpm --filter @lolarr/web build && pnpm --filter @lolarr/tv build` → PASS. (Web nutzt weiterhin `webPlatform` als Default — Verhalten unverändert.)

- [ ] **Step 8: Commit**

```bash
git add packages/player packages/ui packages/features
git commit -m "feat: inject player platform through the player screen"
```

---

### Task 6: apps/tv-Verdrahtung + config.xml-Privileges + Doku

**Files:**
- Modify: `apps/tv/src/App.tsx` (`playerPlatform={tizenPlatform}`)
- Modify: `apps/tv/tizen/config.xml` (Privileges + CSP)
- Modify: `README.md` (Tizen-Playback-Abschnitt)
- Test: keine neuen automatisierten Tests (Integrationsschicht + On-Device); Gates müssen grün bleiben.

**Interfaces:**
- Consumes: `tizenPlatform` (`@lolarr/player`), `LolarrAppProps.playerPlatform` (Task 5).

- [ ] **Step 1: TV-App verdrahten** — `apps/tv/src/App.tsx`: Import `import { tizenPlatform } from '@lolarr/player'`; der `LolarrApp`-Aufruf (aktuell `return <LolarrApp Action={TvAction} TextInput={TvTextInput} Shell={TvShell} />`) wird zu:
```tsx
  return (
    <LolarrApp
      Action={TvAction}
      TextInput={TvTextInput}
      Shell={TvShell}
      playerPlatform={tizenPlatform}
    />
  )
```

- [ ] **Step 2: config.xml** — `apps/tv/tizen/config.xml`: nach den bestehenden zwei `<tizen:privilege>`-Zeilen ergänzen:
```xml
   <tizen:privilege name="http://developer.samsung.com/privilege/avplay"></tizen:privilege>
   <tizen:privilege name="http://tizen.org/privilege/tv.inputdevice"></tizen:privilege>
   <tizen:privilege name="http://developer.samsung.com/privilege/productinfo"></tizen:privilege>
   <tizen:privilege name="http://tizen.org/privilege/systeminfo"></tizen:privilege>
   <tizen:privilege name="http://tizen.org/privilege/tv.audio"></tizen:privilege>
   <tizen:privilege name="http://tizen.org/privilege/network.public"></tizen:privilege>
```
`<tizen:allow-navigation>` auf `*` setzen:
```xml
   <tizen:allow-navigation>*</tizen:allow-navigation>
```
CSP verallgemeinern, sodass beliebige HTTP/HTTPS-Jellyfin-Server + Streams erreichbar sind (Video läuft direkt Client→Jellyfin; AVPlay lädt Streams außerhalb der Web-CSP, aber `connect-src` deckt PlaybackInfo/Progress-`fetch`):
```xml
   <tizen:content-security-policy>default-src 'self' data: blob: http: https:; connect-src 'self' http: https:; img-src 'self' data: blob: https: http:; media-src 'self' blob: http: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'</tizen:content-security-policy>
```

- [ ] **Step 3: README** — im `README.md` einen Abschnitt „Tizen TV playback" ergänzen (nach dem bestehenden Requirements-/Setup-Abschnitt; exakte Platzierung an die vorhandene Struktur anpassen):
```markdown
## Tizen TV playback

The TV app plays video through Samsung's native AVPlay API (`packages/player` →
`tizenPlatform`), injected via `LolarrApp`'s `playerPlatform` prop. Web keeps the
default `webPlatform` (HTML5 `<video>` + hls.js). Requirements on the TV:

- `config.xml` privileges: `avplay`, `tv.inputdevice`, `productinfo`, `systeminfo`,
  `tv.audio`, `internet`, `network.public`.
- Build and package: `pnpm --filter @lolarr/tv tizen:sync`, then load the `apps/tv/tizen`
  project in Tizen Studio and deploy to the device (a signed `.wgt` is not produced by CI).
- DTS/DCA audio always transcodes (unsupported on every Tizen year). The device profile
  detects the model year to enable HEVC/VP9/AV1 where available.
- On-device verification is manual — there is no Tizen emulator in CI.
```

- [ ] **Step 4: Gates** — `pnpm test && pnpm typecheck && pnpm lint && pnpm --filter @lolarr/web build && pnpm --filter @lolarr/tv build` → alles PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/tv README.md
git commit -m "feat: wire tizen platform into the tv app with avplay privileges"
```
