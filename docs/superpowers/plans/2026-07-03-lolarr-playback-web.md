# Lolarr Slice 3: Playback Web — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filme/Episoden spielen im Browser — DirectPlay/HLS via PlaybackInfo, Custom-Controls, Auto-Resume, Autoplay-Next, Progress-Reporting direkt Client→Jellyfin.

**Architecture:** Client-direkt (Ansatz A): `packages/jellyfin` erhält Playback-Calls (Header-Auth mit Session aus `lolarr.jellyfin`), neues `packages/player` kapselt DeviceProfile-Bau, Player-Interface (WebPlayer mit hls.js) und die UI-freie `PlaybackSession`-Orchestrierung (Source-Wahl, Ein-Mal-Transcode-Retry, ProgressReporter). Einzige Server-Änderung: `resumePositionTicks` + `seriesId` im Mapping.

**Tech Stack:** hls.js ^1, React 19, zustand, Vitest (fake timers, gestubbtes fetch/MediaSource).

**Spec:** `docs/superpowers/specs/2026-07-03-lolarr-playback-web-design.md` — bei Widerspruch gewinnt die Spec.

## Global Constraints

- Streams/PlaybackInfo/Progress laufen NIE durchs BFF; Token erscheint in Stream-URLs als `api_key`-Query (unvermeidlich bei `<video>`), sonst Header-Auth.
- Client-Header: `MediaBrowser Client="Lolarr", Device="Lolarr Web", DeviceId="${session.deviceId}", Version="0.1.0", Token="${session.accessToken}"` — deviceId des GERÄTS (aus `lolarr.jellyfin`), nicht `lolarr-gateway`.
- Ticks: 1 Sekunde = 10_000_000. Progress-Intervall 10 s + sofort bei Pause/Resume/Seek. Autoplay-Countdown 10 s.
- Retry-Regel: `error` bei `kind:'direct'` → genau EIN erneuter PlaybackInfo mit `enableDirectPlay:false`; `error` bei `kind:'hls'` → kein Retry. `stopActiveEncodings` nur bei hls-Quelle.
- Repo-Regeln: erasableSyntaxOnly (keine TS-Parameter-Properties), ESM `.js`-Imports in packages/jellyfin+player+apps/api, `react-refresh`-Lint, UI-Texte englisch, Conventional Commits englisch.
- Nach jedem Task: `pnpm test && pnpm typecheck` grün (Frontend-Tasks zusätzlich `pnpm lint` + web/tv-Builds).
- Bewusste Plan-Vereinfachung ggü. Spec: KEINE `onOpen(item, context)`-Signaturänderung in ui — HomeScreen gibt der continue-watching-Rail und dem Hero eigene Handler (Row-Weiche liegt in features). Nicht nachträglich einführen.
- Bewusste Plan-Abweichung ggü. Spec (401-Fall): Ein Jellyfin-401 während des Playbacks führt zum ErrorPanel im PlayerScreen („Playback failed" + Back) statt den onUnauthorized-Session-Cleanup direkt auszulösen — der greift automatisch beim nächsten BFF-Call. Kein Plumbing von setToken bis in den Player. Nicht nachträglich einführen; Verbesserung ggf. als Backlog.

---

### Task 1: Domain + BFF-Mapping (resumePositionTicks, seriesId)

**Files:**
- Modify: `packages/domain/src/index.ts` (jellyfin-Unterobjekt, episodeSchema)
- Modify: `apps/api/src/adapters/jellyfinLibrary.ts` (RawJellyfinItem + Mapping)
- Test: `apps/api/tests/jellyfin-library.test.ts` (erweitern)

**Interfaces:**
- Produces: `mediaItemSchema.jellyfin` + `resumePositionTicks: z.number().int().optional()` + `seriesId: z.string().optional()`; `episodeSchema` + `resumePositionTicks: z.number().int().optional()`. Mapping: `UserData.PlaybackPositionTicks` → `resumePositionTicks`, `SeriesId` → `seriesId` (Items UND Episoden).

- [ ] **Step 1: Failing Test** — in `apps/api/tests/jellyfin-library.test.ts`, `describe('mapJellyfinItem')` ergänzen:

```ts
it('maps resume position and series id', () => {
  const item = mapJellyfinItem({
    Id: 'ep2',
    Name: 'Episode',
    Type: 'Episode',
    SeriesName: 'Show',
    SeriesId: 'series-9',
    ParentIndexNumber: 1,
    IndexNumber: 2,
    UserData: { PlaybackPositionTicks: 9_000_000_000, PlayedPercentage: 25 },
  })
  expect(item.jellyfin?.resumePositionTicks).toBe(9_000_000_000)
  expect(item.jellyfin?.seriesId).toBe('series-9')
})
```

- [ ] **Step 2: Rot** — `pnpm --filter @lolarr/api test tests/jellyfin-library.test.ts` → FAIL (Felder undefined + TS-Fehler auf `SeriesId`).

- [ ] **Step 3: Implementieren**

`packages/domain/src/index.ts` — im `jellyfin`-Objekt nach `progressPercent`:
```ts
resumePositionTicks: z.number().int().optional(),
seriesId: z.string().optional(),
```
`episodeSchema` nach `imageTag`: `resumePositionTicks: z.number().int().optional(),`

`apps/api/src/adapters/jellyfinLibrary.ts`:
- `RawJellyfinItem` + `SeriesId?: string` und in `UserData` + `PlaybackPositionTicks?: number`.
- `mapJellyfinItem` im `jellyfin`-Objekt nach `progressPercent`:
```ts
resumePositionTicks: raw.UserData?.PlaybackPositionTicks,
seriesId: raw.SeriesId,
```
- Episode-Mapping in `getLibraryDetail` nach `imageTag`: `resumePositionTicks: episode.UserData?.PlaybackPositionTicks,` (UserData-Typ deckt das Feld jetzt ab).

- [ ] **Step 4: Grün** — `pnpm test && pnpm typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/domain apps/api
git commit -m "feat: expose resume position and series id in jellyfin mapping"
```

---

### Task 2: packages/jellyfin — Playback-API

**Files:**
- Create: `packages/jellyfin/src/playback.ts`
- Modify: `packages/jellyfin/src/index.ts` (Re-Exports)
- Test: `packages/jellyfin/tests/playback.test.ts`

**Interfaces:**
- Consumes: `JellyfinSession` aus `@lolarr/domain`.
- Produces (alle aus `@lolarr/jellyfin`):
```ts
export class JellyfinRequestError extends Error { readonly status: number }
export type MediaSourceInfo = {
  id: string; container?: string
  supportsDirectPlay: boolean; supportsDirectStream: boolean
  transcodingUrl?: string; etag?: string
}
export type PlaybackInfoResult = { playSessionId: string; mediaSources: MediaSourceInfo[] }
export async function getPlaybackInfo(session, itemId, opts: {
  deviceProfile: unknown; startTimeTicks?: number
  maxStreamingBitrate?: number; enableDirectPlay?: boolean
}): Promise<PlaybackInfoResult>
export type StreamSource = { url: string; kind: 'direct' | 'hls' }
export function buildStreamSource(session, itemId, source: MediaSourceInfo, playSessionId: string): StreamSource | null
export type PlaybackProgressInfo = {
  itemId: string; mediaSourceId: string; playSessionId: string
  positionTicks: number; isPaused: boolean; playMethod: 'DirectPlay' | 'Transcode'
}
export async function reportPlaybackStart(session, info: PlaybackProgressInfo): Promise<void>
export async function reportPlaybackProgress(session, info: PlaybackProgressInfo): Promise<void>
export async function reportPlaybackStopped(session, info: PlaybackProgressInfo): Promise<void>
export function buildStoppedBeaconPayload(session, info: PlaybackProgressInfo): { url: string; body: string }
export async function stopActiveEncodings(session, playSessionId: string): Promise<void>
export type NextUpEpisode = { itemId: string; title: string; seasonNumber?: number; episodeNumber?: number }
export async function getNextUpEpisode(session, seriesId: string): Promise<NextUpEpisode | null>
```

- [ ] **Step 1: Failing Test**

`packages/jellyfin/tests/playback.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildStreamSource,
  buildStoppedBeaconPayload,
  getNextUpEpisode,
  getPlaybackInfo,
  JellyfinRequestError,
  reportPlaybackProgress,
  stopActiveEncodings,
} from '../src/playback.js'

const session = { url: 'http://jellyfin.test', accessToken: 'tok', userId: 'u1', deviceId: 'dev1' }
const progressInfo = {
  itemId: 'i1', mediaSourceId: 'ms1', playSessionId: 'ps1',
  positionTicks: 10_000_000, isPaused: false, playMethod: 'DirectPlay' as const,
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('playback api', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts playback info with device profile and auth header', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ PlaySessionId: 'ps1', MediaSources: [
      { Id: 'ms1', Container: 'mkv', SupportsDirectPlay: true, SupportsDirectStream: false },
    ] }))

    const result = await getPlaybackInfo(session, 'i1', {
      deviceProfile: { Name: 'test' },
      startTimeTicks: 5,
      enableDirectPlay: false,
    })

    expect(result.playSessionId).toBe('ps1')
    expect(result.mediaSources[0]).toMatchObject({ id: 'ms1', container: 'mkv', supportsDirectPlay: true })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://jellyfin.test/Items/i1/PlaybackInfo?userId=u1')
    expect((init.headers as Record<string, string>).Authorization).toContain('Token="tok"')
    expect((init.headers as Record<string, string>).Authorization).toContain('DeviceId="dev1"')
    const body = JSON.parse(init.body as string)
    expect(body.DeviceProfile).toEqual({ Name: 'test' })
    expect(body.StartTimeTicks).toBe(5)
    expect(body.EnableDirectPlay).toBe(false)
  })

  it('throws JellyfinRequestError with status on failure', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 401))
    await expect(getPlaybackInfo(session, 'i1', { deviceProfile: {} })).rejects.toMatchObject({ status: 401 })
    fetchMock.mockResolvedValue(jsonResponse({}, 401))
    await expect(getPlaybackInfo(session, 'i1', { deviceProfile: {} })).rejects.toBeInstanceOf(JellyfinRequestError)
  })

  it('builds a direct stream url with api_key query', () => {
    const source = buildStreamSource(session, 'i1', {
      id: 'ms1', container: 'mkv', supportsDirectPlay: true, supportsDirectStream: false, etag: 'e1',
    }, 'ps1')
    expect(source).toEqual({
      kind: 'direct',
      url: 'http://jellyfin.test/Videos/i1/stream.mkv?Static=true&mediaSourceId=ms1&deviceId=dev1&api_key=tok&Tag=e1&playSessionId=ps1',
    })
  })

  it('prefers transcoding url when direct play is not supported', () => {
    const source = buildStreamSource(session, 'i1', {
      id: 'ms1', supportsDirectPlay: false, supportsDirectStream: true,
      transcodingUrl: '/videos/i1/master.m3u8?api_key=tok',
    }, 'ps1')
    expect(source).toEqual({ kind: 'hls', url: 'http://jellyfin.test/videos/i1/master.m3u8?api_key=tok' })
  })

  it('returns null when nothing is playable', () => {
    expect(buildStreamSource(session, 'i1', {
      id: 'ms1', supportsDirectPlay: false, supportsDirectStream: false,
    }, 'ps1')).toBeNull()
  })

  it('reports progress with tick payload', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await reportPlaybackProgress(session, progressInfo)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://jellyfin.test/Sessions/Playing/Progress')
    const body = JSON.parse(init.body as string)
    expect(body).toMatchObject({ ItemId: 'i1', PositionTicks: 10_000_000, IsPaused: false, PlayMethod: 'DirectPlay' })
  })

  it('builds a beacon payload with api_key query', () => {
    const beacon = buildStoppedBeaconPayload(session, progressInfo)
    expect(beacon.url).toBe('http://jellyfin.test/Sessions/Playing/Stopped?api_key=tok')
    expect(JSON.parse(beacon.body)).toMatchObject({ ItemId: 'i1', PlaySessionId: 'ps1' })
  })

  it('stops active encodings with device and session params', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await stopActiveEncodings(session, 'ps1')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://jellyfin.test/Videos/ActiveEncodings?deviceId=dev1&playSessionId=ps1')
    expect((init as RequestInit).method).toBe('DELETE')
  })

  it('fetches the next up episode for a series', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ Items: [
      { Id: 'ep9', Name: 'Next One', ParentIndexNumber: 2, IndexNumber: 3 },
    ] }))
    const next = await getNextUpEpisode(session, 'series-1')
    expect(next).toEqual({ itemId: 'ep9', title: 'Next One', seasonNumber: 2, episodeNumber: 3 })
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe('http://jellyfin.test/Shows/NextUp?seriesId=series-1&userId=u1&limit=1')
  })

  it('returns null when there is no next episode', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ Items: [] }))
    expect(await getNextUpEpisode(session, 'series-1')).toBeNull()
  })
})
```

- [ ] **Step 2: Rot** — `pnpm --filter @lolarr/jellyfin test` → FAIL (Modul fehlt).

- [ ] **Step 3: Implementieren**

`packages/jellyfin/src/playback.ts` (kompletter Inhalt):
```ts
import type { JellyfinSession } from '@lolarr/domain'

export class JellyfinRequestError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'JellyfinRequestError'
    this.status = status
  }
}

export type MediaSourceInfo = {
  id: string
  container?: string
  supportsDirectPlay: boolean
  supportsDirectStream: boolean
  transcodingUrl?: string
  etag?: string
}

export type PlaybackInfoResult = {
  playSessionId: string
  mediaSources: MediaSourceInfo[]
}

export type StreamSource = { url: string; kind: 'direct' | 'hls' }

export type PlaybackProgressInfo = {
  itemId: string
  mediaSourceId: string
  playSessionId: string
  positionTicks: number
  isPaused: boolean
  playMethod: 'DirectPlay' | 'Transcode'
}

export type NextUpEpisode = {
  itemId: string
  title: string
  seasonNumber?: number
  episodeNumber?: number
}

const CLIENT = 'Lolarr'
const DEVICE = 'Lolarr Web'
const VERSION = '0.1.0'

function authorizationHeader(session: JellyfinSession) {
  return `MediaBrowser Client="${CLIENT}", Device="${DEVICE}", DeviceId="${session.deviceId}", Version="${VERSION}", Token="${session.accessToken}"`
}

async function jellyfinRequest(
  session: JellyfinSession,
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<Response> {
  const headers: Record<string, string> = { Authorization: authorizationHeader(session) }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${session.url}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    throw new JellyfinRequestError(response.status, `Jellyfin request failed: ${path}`)
  }
  return response
}

export async function getPlaybackInfo(
  session: JellyfinSession,
  itemId: string,
  opts: {
    deviceProfile: unknown
    startTimeTicks?: number
    maxStreamingBitrate?: number
    enableDirectPlay?: boolean
  },
): Promise<PlaybackInfoResult> {
  const response = await jellyfinRequest(
    session,
    `/Items/${encodeURIComponent(itemId)}/PlaybackInfo?userId=${encodeURIComponent(session.userId)}`,
    {
      method: 'POST',
      body: {
        DeviceProfile: opts.deviceProfile,
        StartTimeTicks: opts.startTimeTicks,
        MaxStreamingBitrate: opts.maxStreamingBitrate,
        EnableDirectPlay: opts.enableDirectPlay,
        AutoOpenLiveStream: true,
      },
    },
  )

  const payload = (await response.json()) as {
    PlaySessionId?: string
    MediaSources?: Array<{
      Id: string
      Container?: string
      SupportsDirectPlay?: boolean
      SupportsDirectStream?: boolean
      TranscodingUrl?: string
      ETag?: string
    }>
  }

  return {
    playSessionId: payload.PlaySessionId ?? '',
    mediaSources: (payload.MediaSources ?? []).map((source) => ({
      id: source.Id,
      container: source.Container,
      supportsDirectPlay: source.SupportsDirectPlay === true,
      supportsDirectStream: source.SupportsDirectStream === true,
      transcodingUrl: source.TranscodingUrl,
      etag: source.ETag,
    })),
  }
}

export function buildStreamSource(
  session: JellyfinSession,
  itemId: string,
  source: MediaSourceInfo,
  playSessionId: string,
): StreamSource | null {
  if (source.supportsDirectPlay && source.container) {
    const params = new URLSearchParams({
      Static: 'true',
      mediaSourceId: source.id,
      deviceId: session.deviceId,
      api_key: session.accessToken,
    })
    if (source.etag) {
      params.set('Tag', source.etag)
    }
    params.set('playSessionId', playSessionId)
    return {
      kind: 'direct',
      url: `${session.url}/Videos/${encodeURIComponent(itemId)}/stream.${source.container}?${params.toString()}`,
    }
  }

  if (source.transcodingUrl) {
    return { kind: 'hls', url: `${session.url}${source.transcodingUrl}` }
  }

  return null
}

function progressBody(info: PlaybackProgressInfo) {
  return {
    ItemId: info.itemId,
    MediaSourceId: info.mediaSourceId,
    PlaySessionId: info.playSessionId,
    PositionTicks: info.positionTicks,
    IsPaused: info.isPaused,
    PlayMethod: info.playMethod,
  }
}

export async function reportPlaybackStart(session: JellyfinSession, info: PlaybackProgressInfo) {
  await jellyfinRequest(session, '/Sessions/Playing', { method: 'POST', body: progressBody(info) })
}

export async function reportPlaybackProgress(session: JellyfinSession, info: PlaybackProgressInfo) {
  await jellyfinRequest(session, '/Sessions/Playing/Progress', { method: 'POST', body: progressBody(info) })
}

export async function reportPlaybackStopped(session: JellyfinSession, info: PlaybackProgressInfo) {
  await jellyfinRequest(session, '/Sessions/Playing/Stopped', { method: 'POST', body: progressBody(info) })
}

// sendBeacon kann keine Header setzen — Token als Query-Param.
export function buildStoppedBeaconPayload(session: JellyfinSession, info: PlaybackProgressInfo) {
  return {
    url: `${session.url}/Sessions/Playing/Stopped?api_key=${encodeURIComponent(session.accessToken)}`,
    body: JSON.stringify(progressBody(info)),
  }
}

export async function stopActiveEncodings(session: JellyfinSession, playSessionId: string) {
  const params = new URLSearchParams({ deviceId: session.deviceId, playSessionId })
  await jellyfinRequest(session, `/Videos/ActiveEncodings?${params.toString()}`, { method: 'DELETE' })
}

export async function getNextUpEpisode(
  session: JellyfinSession,
  seriesId: string,
): Promise<NextUpEpisode | null> {
  const params = new URLSearchParams({ seriesId, userId: session.userId, limit: '1' })
  const response = await jellyfinRequest(session, `/Shows/NextUp?${params.toString()}`)
  const payload = (await response.json()) as {
    Items?: Array<{ Id: string; Name: string; ParentIndexNumber?: number; IndexNumber?: number }>
  }
  const item = payload.Items?.[0]
  if (!item) {
    return null
  }
  return {
    itemId: item.Id,
    title: item.Name,
    seasonNumber: item.ParentIndexNumber,
    episodeNumber: item.IndexNumber,
  }
}
```

`packages/jellyfin/src/index.ts`: am Ende `export * from './playback.js'`.

- [ ] **Step 4: Grün** — `pnpm --filter @lolarr/jellyfin test && pnpm typecheck && pnpm lint` → PASS (12+ Tests).

- [ ] **Step 5: Commit**

```bash
git add packages/jellyfin
git commit -m "feat: client-side jellyfin playback api"
```

---

### Task 3: packages/player — Gerüst, DeviceProfile, WebPlayer

**Files:**
- Create: `packages/player/package.json`, `tsconfig.json`, `moon.yml`, `vitest.config.ts`
- Create: `packages/player/src/deviceProfile.ts`, `packages/player/src/types.ts`, `packages/player/src/webPlayer.ts`, `packages/player/src/index.ts`
- Test: `packages/player/tests/deviceProfile.test.ts`

**Interfaces:**
- Produces (aus `@lolarr/player`):
```ts
// types.ts
export type PlayerEvent = 'timeupdate' | 'ended' | 'error' | 'waiting' | 'playing' | 'pause'
export interface Player {
  load(source: StreamSource, opts: { startSeconds?: number }): Promise<void>
  play(): void
  pause(): void
  seek(seconds: number): void
  setVolume(volume: number): void
  getPosition(): number
  getDuration(): number
  on(event: PlayerEvent, handler: (detail?: unknown) => void): () => void
  dispose(): void
}
// deviceProfile.ts
export function buildDeviceProfile(): DeviceProfile   // Jellyfin-DeviceProfile-Objekt (opak für Aufrufer)
// webPlayer.ts
export class WebPlayer implements Player { constructor(video: HTMLVideoElement) }
```

- [ ] **Step 1: Package-Gerüst**

`packages/player/package.json`:
```json
{
  "name": "@lolarr/player",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "build": "pnpm run typecheck",
    "lint": "eslint .",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@lolarr/domain": "workspace:*",
    "@lolarr/jellyfin": "workspace:*",
    "hls.js": "^1.6.0"
  },
  "devDependencies": { "vitest": "^3" }
}
```
`tsconfig.json`, `vitest.config.ts`: 1:1 von `packages/jellyfin`. `moon.yml`: von `packages/jellyfin` kopieren, id/tags auf `player` (inkl. `test`-Task — dort seit S2 vorhanden). `.moon/workspace.yml`: `player: 'packages/player'` ergänzen (Muster `jellyfin`-Zeile). Dann `pnpm install`.

- [ ] **Step 2: Failing Test**

`packages/player/tests/deviceProfile.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildDeviceProfile } from '../src/deviceProfile.js'

type DirectPlayProfile = { Container: string; Type: string; VideoCodec?: string; AudioCodec?: string }
type Profile = {
  MaxStreamingBitrate: number
  DirectPlayProfiles: DirectPlayProfile[]
  TranscodingProfiles: Array<{ Container: string; Protocol: string; VideoCodec: string; AudioCodec: string }>
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('buildDeviceProfile', () => {
  it('falls back to a conservative h264/aac profile without MediaSource', () => {
    const profile = buildDeviceProfile() as Profile
    const video = profile.DirectPlayProfiles.find((p) => p.Type === 'Video')
    expect(video?.VideoCodec).toBe('h264')
    expect(video?.AudioCodec).toContain('aac')
    expect(profile.TranscodingProfiles[0]).toMatchObject({ Protocol: 'hls', VideoCodec: 'h264' })
  })

  it('includes codecs the browser reports as supported', () => {
    vi.stubGlobal('MediaSource', {
      isTypeSupported: (type: string) => type.includes('hvc1') || type.includes('avc1') || type.includes('mp4a'),
    })
    const profile = buildDeviceProfile() as Profile
    const video = profile.DirectPlayProfiles.find((p) => p.Type === 'Video')
    expect(video?.VideoCodec).toContain('hevc')
    expect(video?.VideoCodec).toContain('h264')
    expect(video?.VideoCodec).not.toContain('av1')
  })
})
```

- [ ] **Step 3: Rot** — `pnpm --filter @lolarr/player test` → FAIL.

- [ ] **Step 4: Implementieren**

`packages/player/src/types.ts`: Interface wie oben (Import `StreamSource` aus `@lolarr/jellyfin`).

`packages/player/src/deviceProfile.ts`:
```ts
export type DeviceProfile = Record<string, unknown>

type TypeSupportCheck = (type: string) => boolean

const VIDEO_CODEC_PROBES: Array<{ codec: string; mime: string }> = [
  { codec: 'h264', mime: 'video/mp4; codecs="avc1.42E01E"' },
  { codec: 'hevc', mime: 'video/mp4; codecs="hvc1.1.6.L93.B0"' },
  { codec: 'vp9', mime: 'video/webm; codecs="vp9"' },
  { codec: 'av1', mime: 'video/mp4; codecs="av01.0.04M.08"' },
]

const AUDIO_CODEC_PROBES: Array<{ codec: string; mime: string }> = [
  { codec: 'aac', mime: 'audio/mp4; codecs="mp4a.40.2"' },
  { codec: 'mp3', mime: 'audio/mpeg' },
  { codec: 'ac3', mime: 'audio/mp4; codecs="ac-3"' },
  { codec: 'eac3', mime: 'audio/mp4; codecs="ec-3"' },
  { codec: 'opus', mime: 'audio/webm; codecs="opus"' },
  { codec: 'flac', mime: 'audio/mp4; codecs="flac"' },
]

export function buildDeviceProfile(): DeviceProfile {
  const isSupported = resolveTypeSupport()
  const videoCodecs = probe(VIDEO_CODEC_PROBES, isSupported, ['h264'])
  const audioCodecs = probe(AUDIO_CODEC_PROBES, isSupported, ['aac'])

  return {
    Name: 'Lolarr Web',
    MaxStreamingBitrate: 120_000_000,
    DirectPlayProfiles: [
      {
        Container: 'mp4,m4v,mkv,webm',
        Type: 'Video',
        VideoCodec: videoCodecs.join(','),
        AudioCodec: audioCodecs.join(','),
      },
      { Container: 'mp3,aac,m4a,flac,ogg', Type: 'Audio' },
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

function resolveTypeSupport(): TypeSupportCheck | undefined {
  const mediaSource = (globalThis as { MediaSource?: { isTypeSupported?: TypeSupportCheck } }).MediaSource
  const check = mediaSource?.isTypeSupported
  return check ? check.bind(mediaSource) : undefined
}

function probe(
  probes: Array<{ codec: string; mime: string }>,
  isSupported: TypeSupportCheck | undefined,
  fallback: string[],
): string[] {
  if (!isSupported) {
    return fallback
  }
  const supported = probes.filter((probeEntry) => isSupported(probeEntry.mime)).map((p) => p.codec)
  return supported.length > 0 ? supported : fallback
}
```

`packages/player/src/webPlayer.ts`:
```ts
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
      // direct play — oder natives HLS (Safari)
      this.video.src = source.url
    }

    if (opts.startSeconds && opts.startSeconds > 0) {
      this.video.currentTime = opts.startSeconds
    }
    await this.video.play().catch(() => {
      // Autoplay-Block: Nutzer startet über Controls; kein Fehlerzustand.
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
```
Hinweis Safari: `kind:'hls'` + `!Hls.isSupported()` fällt auf `video.src` zurück (natives HLS) — bewusst derselbe Zweig wie direct.

`packages/player/src/index.ts`:
```ts
export { buildDeviceProfile, type DeviceProfile } from './deviceProfile.js'
export type { Player, PlayerEvent } from './types.js'
export { WebPlayer } from './webPlayer.js'
```

- [ ] **Step 5: Grün** — `pnpm --filter @lolarr/player test && pnpm typecheck && pnpm lint` → PASS (WebPlayer nur typecheck — DOM-frei nicht unit-testbar, Abdeckung via manueller Smoke).

- [ ] **Step 6: Commit**

```bash
git add packages/player .moon/workspace.yml pnpm-lock.yaml
git commit -m "feat: player package with device profile builder and hls web player"
```

---

### Task 4: packages/player — PlaybackSession + ProgressReporter

**Files:**
- Create: `packages/player/src/playbackSession.ts`
- Modify: `packages/player/src/index.ts`
- Test: `packages/player/tests/playbackSession.test.ts`

**Interfaces:**
- Consumes: `Player` (Task 3), Playback-API (Task 2).
- Produces:
```ts
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
export function createPlaybackSession(deps: {
  session: JellyfinSession
  player: Player
  itemId: string
  resumeTicks?: number
  onStateChange(state: PlaybackSessionState, detail?: { message?: string }): void
  api?: PlaybackApi          // Default: echte Funktionen aus @lolarr/jellyfin — Injektion für Tests
  deviceProfile?: unknown    // Default: buildDeviceProfile()
}): PlaybackSessionHandle
```

- [ ] **Step 1: Failing Tests**

`packages/player/tests/playbackSession.test.ts`:
```ts
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
```

- [ ] **Step 2: Rot** — `pnpm --filter @lolarr/player test` → FAIL.

- [ ] **Step 3: Implementieren**

`packages/player/src/playbackSession.ts`:
```ts
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
```
`index.ts`: `export { createPlaybackSession, type PlaybackApi, type PlaybackSessionHandle, type PlaybackSessionState } from './playbackSession.js'`

- [ ] **Step 4: Grün** — `pnpm --filter @lolarr/player test && pnpm typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/player
git commit -m "feat: playback session orchestration with progress reporting and transcode retry"
```

---

### Task 5: PlayerScreen + Controls (features/ui)

**Files:**
- Modify: `packages/features/src/navigation/store.ts` (`player`-Screen + `replace()`)
- Modify: `packages/features/package.json` (+`@lolarr/player`)
- Create: `packages/features/src/player/usePlaybackSession.ts`, `packages/features/src/player/PlayerScreen.tsx`
- Create: `packages/ui/src/components/PlayerControls.tsx`
- Modify: `packages/ui/src/index.ts`, `packages/ui/src/styles.css`
- Modify: `packages/features/src/experience.tsx` (player-Zweig)

**Interfaces:**
- Produces:
```ts
// store.ts:
export type Screen = … | { name: 'player'; itemId: string; resumeTicks?: number; seriesId?: string }
// + replace: (screen: Screen) => void   — ersetzt das Stack-Top (Stack nie leer)
// PlayerScreen-Props: { Action, storage, itemId, resumeTicks?, seriesId?, onExit(): void, onPlayNext(next: { itemId: string; seriesId?: string }): void }
// PlayerControls-Props: { visible, isPaused, position, duration, volume, title, onTogglePause, onSeekTo(seconds), onSeekBy(seconds), onVolume(v), onFullscreen, onBack, Action }
```
- Autoplay-Overlay kommt in Task 6 — dieser Task endet mit „Ende → onExit()".

- [ ] **Step 1: Navigation + Dependency**

`store.ts`: Screen-Union + `{ name: 'player'; itemId: string; resumeTicks?: number; seriesId?: string }`; im Store:
```ts
replace: (screen) =>
  set((state) => ({ stack: [...state.stack.slice(0, -1), screen] })),
```
(+ Typ in `ScreenState`). `packages/features/package.json`: `"@lolarr/player": "workspace:*"`; `pnpm install`.

- [ ] **Step 2: Hook**

`packages/features/src/player/usePlaybackSession.ts`:
```ts
import { useEffect, useRef, useState } from 'react'
import { readJellyfinSession } from '@lolarr/jellyfin'
import {
  createPlaybackSession,
  WebPlayer,
  type PlaybackSessionHandle,
  type PlaybackSessionState,
} from '@lolarr/player'
import type { KeyValueStorage } from '../storage.js'

export function usePlaybackSession({
  storage,
  itemId,
  resumeTicks,
}: {
  storage: KeyValueStorage
  itemId: string
  resumeTicks?: number
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const handleRef = useRef<PlaybackSessionHandle | null>(null)
  const [state, setState] = useState<PlaybackSessionState>('loading')
  const [errorMessage, setErrorMessage] = useState<string>()
  const [progress, setProgress] = useState({ position: 0, duration: Number.NaN })

  useEffect(() => {
    const jellyfinSession = readJellyfinSession(storage)
    const video = videoRef.current
    if (!jellyfinSession || !video) {
      setState('error')
      setErrorMessage(jellyfinSession ? 'Player unavailable' : 'Session missing — please sign in again')
      return
    }

    const player = new WebPlayer(video)
    const handle = createPlaybackSession({
      session: jellyfinSession,
      player,
      itemId,
      resumeTicks,
      onStateChange: (nextState, detail) => {
        setState(nextState)
        if (detail?.message) {
          setErrorMessage(detail.message)
        }
      },
    })
    handleRef.current = handle
    void handle.start()

    const progressPoll = setInterval(() => {
      setProgress(handle.getProgress())
    }, 500)

    return () => {
      clearInterval(progressPoll)
      handleRef.current = null
      void handle.stop()
    }
  }, [storage, itemId, resumeTicks])

  return { videoRef, state, errorMessage, progress, handle: handleRef }
}
```

- [ ] **Step 3: PlayerScreen + Controls + CSS**

`packages/features/src/player/PlayerScreen.tsx`:
```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { ErrorPanel, PlayerControls, type ActionComponent } from '@lolarr/ui'
import type { KeyValueStorage } from '../storage.js'
import { usePlaybackSession } from './usePlaybackSession.js'

const CONTROLS_HIDE_MS = 3000

export function PlayerScreen({
  Action,
  storage,
  itemId,
  title,
  onExit,
}: {
  Action: ActionComponent
  storage: KeyValueStorage
  itemId: string
  title?: string
  resumeTicks?: number
  onExit: () => void
}) {
  // resumeTicks kommt aus den Props (oben destrukturiert) und geht 1:1 an usePlaybackSession.
  const containerRef = useRef<HTMLDivElement>(null)
  const { videoRef, state, errorMessage, progress, handle } = usePlaybackSession({
    storage,
    itemId,
    resumeTicks,
  })
  const [controlsVisible, setControlsVisible] = useState(true)
  const [volume, setVolume] = useState(1)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(null)

  const showControls = useCallback(() => {
    setControlsVisible(true)
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
    }
    hideTimer.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS)
  }, [])

  useEffect(() => {
    showControls()
    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current)
      }
    }
  }, [showControls])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      showControls()
      if (event.key === ' ') {
        event.preventDefault()
        handle.current?.togglePause()
      } else if (event.key === 'ArrowLeft') {
        handle.current?.seekBy(-10)
      } else if (event.key === 'ArrowRight') {
        handle.current?.seekBy(10)
      } else if (event.key === 'f' || event.key === 'F') {
        toggleFullscreen()
      } else if (event.key === 'Escape') {
        onExit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void containerRef.current?.requestFullscreen()
    }
  }

  if (state === 'error') {
    return (
      <div className="player-screen">
        <ErrorPanel message={errorMessage ?? 'Playback failed'} />
        <Action onPress={onExit} focusKey="player-back">Back</Action>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="player-screen" onMouseMove={showControls}>
      <video ref={videoRef} className="player-video" />
      {state === 'loading' ? <div className="player-spinner" aria-label="Loading" /> : null}
      <PlayerControls
        Action={Action}
        visible={controlsVisible}
        isPaused={state === 'paused'}
        position={progress.position}
        duration={progress.duration}
        volume={volume}
        title={title}
        onTogglePause={() => handle.current?.togglePause()}
        onSeekTo={(seconds) => handle.current?.seekTo(seconds)}
        onSeekBy={(seconds) => handle.current?.seekBy(seconds)}
        onVolume={(value) => {
          setVolume(value)
          videoRef.current && (videoRef.current.volume = value)
        }}
        onFullscreen={toggleFullscreen}
        onBack={onExit}
      />
    </div>
  )
}
```
**Hinweis für den Implementer:** die `resumeTicks`-Prop natürlich normal destrukturieren und an `usePlaybackSession` durchreichen — die Zeile mit `arguments.length` oben ist ein Platzhalter-Artefakt des Plans und darf so nicht übernommen werden; korrekt: `const { videoRef, … } = usePlaybackSession({ storage, itemId, resumeTicks })`.

`packages/ui/src/components/PlayerControls.tsx`:
```tsx
import type { ActionComponent } from './types'

type PlayerControlsProps = {
  Action: ActionComponent
  visible: boolean
  isPaused: boolean
  position: number
  duration: number
  volume: number
  title?: string
  onTogglePause: () => void
  onSeekTo: (seconds: number) => void
  onSeekBy: (seconds: number) => void
  onVolume: (volume: number) => void
  onFullscreen: () => void
  onBack: () => void
}

export function PlayerControls({
  Action,
  visible,
  isPaused,
  position,
  duration,
  volume,
  title,
  onTogglePause,
  onSeekTo,
  onSeekBy,
  onVolume,
  onFullscreen,
  onBack,
}: PlayerControlsProps) {
  const hasDuration = Number.isFinite(duration) && duration > 0

  return (
    <div className={visible ? 'player-controls visible' : 'player-controls'}>
      <div className="player-controls-top">
        <Action onPress={onBack} focusKey="player-back" ariaLabel="Back">←</Action>
        {title ? <span className="player-title">{title}</span> : null}
      </div>
      <div className="player-controls-bottom">
        <input
          className="player-seekbar"
          type="range"
          min={0}
          max={hasDuration ? Math.floor(duration) : 0}
          value={Math.floor(position)}
          onChange={(event) => onSeekTo(Number(event.currentTarget.value))}
          aria-label="Seek"
        />
        <div className="player-buttons">
          <Action onPress={() => onSeekBy(-10)} focusKey="player-rewind" ariaLabel="Back 10 seconds">⟲10</Action>
          <Action onPress={onTogglePause} focusKey="player-pause" ariaLabel={isPaused ? 'Play' : 'Pause'}>
            {isPaused ? '▶' : '⏸'}
          </Action>
          <Action onPress={() => onSeekBy(10)} focusKey="player-forward" ariaLabel="Forward 10 seconds">⟳10</Action>
          <span className="player-time">
            {formatTime(position)} / {hasDuration ? formatTime(duration) : '–:––'}
          </span>
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
          <Action onPress={onFullscreen} focusKey="player-fullscreen" ariaLabel="Fullscreen">⛶</Action>
        </div>
      </div>
    </div>
  )
}

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '0:00'
  }
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes)
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}
```
`ui/index.ts`: `PlayerControls` re-exportieren. `styles.css` anhängen:
```css
.player-screen {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 100;
}

.player-video { width: 100%; height: 100%; object-fit: contain; }

.player-controls {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1.5rem;
  background: linear-gradient(rgba(0, 0, 0, 0.6), transparent 25%, transparent 75%, rgba(0, 0, 0, 0.75));
  opacity: 0;
  transition: opacity 0.25s ease;
  pointer-events: none;
}

.player-controls.visible { opacity: 1; pointer-events: auto; }
.player-controls-top { display: flex; align-items: center; gap: 1rem; }
.player-title { font-size: 1.1rem; font-weight: 600; }
.player-controls-bottom { display: flex; flex-direction: column; gap: 0.75rem; }
.player-seekbar { width: 100%; accent-color: #e50914; }
.player-buttons { display: flex; align-items: center; gap: 0.75rem; }
.player-time { font-variant-numeric: tabular-nums; opacity: 0.85; }
.player-volume { width: 110px; accent-color: #e50914; }

.player-spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 48px;
  height: 48px;
  margin: -24px 0 0 -24px;
  border: 4px solid rgba(255, 255, 255, 0.25);
  border-top-color: #e50914;
  border-radius: 50%;
  animation: player-spin 0.8s linear infinite;
}

@keyframes player-spin { to { transform: rotate(360deg); } }
```

- [ ] **Step 4: experience.tsx — player-Zweig** (vor dem libraryDetail-Zweig):
```tsx
if (currentScreen.name === 'player') {
  return (
    <PlayerScreen
      key={currentScreen.itemId}
      Action={Action}
      storage={storage}
      itemId={currentScreen.itemId}
      resumeTicks={currentScreen.resumeTicks}
      onExit={() => {
        void queryClient.invalidateQueries({ queryKey: ['home'] })
        useScreenStore.getState().pop()
      }}
    />
  )
}
```
(`title`-Prop entfällt hier — PlayerScreen kommt ohne aus; `seriesId` wird erst in Task 6 konsumiert.)

- [ ] **Step 5: Verifizieren** — `pnpm test && pnpm typecheck && pnpm lint && pnpm --filter @lolarr/web build && pnpm --filter @lolarr/tv build` → grün.

- [ ] **Step 6: Commit**

```bash
git add packages/features packages/ui pnpm-lock.yaml
git commit -m "feat: player screen with custom controls and keyboard shortcuts"
```

---

### Task 6: Einstiege + Autoplay-Next

**Files:**
- Modify: `packages/features/src/library/LibraryDetailScreen.tsx` (▶ aktivieren, Start-from-beginning, Episode-Play)
- Modify: `packages/ui/src/components/EpisodeList.tsx` (optionales onPlay)
- Modify: `packages/features/src/experience.tsx` + `packages/features/src/home/HomeScreen.tsx` (Direkt-Play für continue-watching/Hero)
- Create: `packages/features/src/player/AutoplayNext.tsx`
- Create: `packages/ui/src/components/AutoplayOverlay.tsx`
- Modify: `packages/features/src/player/PlayerScreen.tsx` (ended → AutoplayNext)
- Modify: `packages/ui/src/index.ts`, `packages/ui/src/styles.css`

**Interfaces:**
- Consumes: `getNextUpEpisode` (Task 2), `replace()` (Task 5), `Screen 'player'` (Task 5).
- Produces:
```ts
// EpisodeList: { episodes, Action?, onPlay?: (episode: Episode) => void } — ohne onPlay wie bisher
// AutoplayOverlay: { Action, title, secondsLeft, onPlayNow, onCancel }
// HomeScreen erhält neue Prop onPlayItem: (item: MediaItem) => void
// PlayerScreen erhält seriesId?: string + onPlayNext(itemId: string): void
```

- [ ] **Step 1: LibraryDetail — ▶ + Episoden**

`LibraryDetailScreen.tsx`: neue Prop `onPlay: (opts: { itemId: string; resumeTicks?: number; seriesId?: string }) => void`. Actions-Block ersetzen:
```tsx
<div className="library-detail-actions">
  <Action
    onPress={() => onPlay({
      itemId: item.jellyfin?.itemId ?? itemId,
      resumeTicks: item.jellyfin?.resumePositionTicks,
      seriesId: item.jellyfin?.seriesId,
    })}
    focusKey="library-play"
    ariaLabel="Play"
  >
    ▶ Play
  </Action>
  {item.jellyfin?.resumePositionTicks ? (
    <Action
      onPress={() => onPlay({ itemId: item.jellyfin?.itemId ?? itemId, seriesId: item.jellyfin?.seriesId })}
      focusKey="library-play-restart"
    >
      Start from beginning
    </Action>
  ) : null}
  <Action onPress={onBack} focusKey="library-back">Back</Action>
</div>
```
Episoden: `<EpisodeList episodes={season.episodes} Action={Action} onPlay={(episode) => onPlay({ itemId: episode.jellyfinItemId, resumeTicks: episode.resumePositionTicks, seriesId: itemId })} />` — `seriesId` ist hier die Serie selbst (`itemId` des Screens).

`EpisodeList.tsx` — Signatur erweitern (abwärtskompatibel):
```tsx
import type { Episode } from '@lolarr/domain'
import type { ActionComponent } from './types'

export function EpisodeList({
  episodes,
  Action,
  onPlay,
}: {
  episodes: Episode[]
  Action?: ActionComponent
  onPlay?: (episode: Episode) => void
}) {
  return (
    <ol className="episode-list">
      {episodes.map((episode) => (
        <li key={episode.id} className="episode-row">
          {Action && onPlay ? (
            <Action
              onPress={() => onPlay(episode)}
              focusKey={`episode-play-${episode.id}`}
              ariaLabel={`Play ${episode.title}`}
              className="episode-play"
            >
              ▶
            </Action>
          ) : null}
          <span className="episode-number">{episode.episodeNumber}</span>
          {/* Rest unverändert */}
        </li>
      ))}
    </ol>
  )
}
```
CSS: `.episode-play { flex-shrink: 0; }`.

`experience.tsx` — libraryDetail-Zweig + `onPlay`:
```tsx
onPlay={({ itemId, resumeTicks, seriesId }) =>
  useScreenStore.getState().push({ name: 'player', itemId, resumeTicks, seriesId })
}
```

- [ ] **Step 2: Home-Direkteinstieg**

`experience.tsx`: HomeScreen erhält zusätzlich
```tsx
onPlayItem={(item) =>
  item.jellyfin
    ? useScreenStore.getState().push({
        name: 'player',
        itemId: item.jellyfin.itemId,
        resumeTicks: item.jellyfin.resumePositionTicks,
        seriesId: item.jellyfin.seriesId,
      })
    : useScreenStore.getState().push({ name: 'detail', item })
}
```
`HomeScreen.tsx`: Prop `onPlayItem: (item: MediaItem) => void`; beim Rendern: Hero → `onOpen={onPlayItem}` NUR wenn `featuredItem?.jellyfin` (sonst `onOpenItem`); Rails → `onOpen={row.id === 'continue-watching' ? onPlayItem : onOpenItem}`. Search-Branch unverändert (`onOpenItem`).

- [ ] **Step 3: Autoplay-Next**

`packages/ui/src/components/AutoplayOverlay.tsx`:
```tsx
import type { ActionComponent } from './types'

export function AutoplayOverlay({
  Action,
  title,
  secondsLeft,
  onPlayNow,
  onCancel,
}: {
  Action: ActionComponent
  title: string
  secondsLeft: number
  onPlayNow: () => void
  onCancel: () => void
}) {
  return (
    <div className="autoplay-overlay">
      <p className="autoplay-label">Next episode in {secondsLeft}s</p>
      <p className="autoplay-title">{title}</p>
      <div className="autoplay-actions">
        <Action onPress={onPlayNow} focusKey="autoplay-now">Play now</Action>
        <Action onPress={onCancel} focusKey="autoplay-cancel">Cancel</Action>
      </div>
    </div>
  )
}
```
CSS:
```css
.autoplay-overlay {
  position: absolute;
  right: 2rem;
  bottom: 2.5rem;
  background: rgba(10, 10, 14, 0.92);
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
  max-width: 320px;
}
.autoplay-label { opacity: 0.7; font-size: 0.85rem; }
.autoplay-title { font-weight: 600; margin: 0.25rem 0 0.75rem; }
.autoplay-actions { display: flex; gap: 0.75rem; }
```

`packages/features/src/player/AutoplayNext.tsx`:
```tsx
import { useEffect, useMemo, useState } from 'react'
import { getNextUpEpisode, readJellyfinSession, type NextUpEpisode } from '@lolarr/jellyfin'
import { AutoplayOverlay, type ActionComponent } from '@lolarr/ui'
import type { KeyValueStorage } from '../storage.js'

const COUNTDOWN_SECONDS = 10

export function AutoplayNext({
  Action,
  storage,
  seriesId,
  onPlayNext,
  onDone,
}: {
  Action: ActionComponent
  storage: KeyValueStorage
  seriesId: string
  onPlayNext: (itemId: string) => void
  onDone: () => void
}) {
  const session = useMemo(() => readJellyfinSession(storage), [storage])
  const [next, setNext] = useState<NextUpEpisode | null>()
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS)

  useEffect(() => {
    if (!session) {
      onDone()
      return
    }
    let cancelled = false
    getNextUpEpisode(session, seriesId)
      .then((episode) => {
        if (!cancelled) {
          setNext(episode)
          if (!episode) {
            onDone()
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          onDone()
        }
      })
    return () => {
      cancelled = true
    }
  }, [session, seriesId, onDone])

  useEffect(() => {
    if (!next) {
      return
    }
    if (secondsLeft <= 0) {
      onPlayNext(next.itemId)
      return
    }
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [next, secondsLeft, onPlayNext])

  if (!next) {
    return null
  }

  return (
    <AutoplayOverlay
      Action={Action}
      title={next.title}
      secondsLeft={secondsLeft}
      onPlayNow={() => onPlayNext(next.itemId)}
      onCancel={onDone}
    />
  )
}
```

`PlayerScreen.tsx`: Props + `seriesId?: string` und `onPlayNext: (itemId: string) => void`; im Render (nicht-error):
```tsx
{state === 'ended' && seriesId ? (
  <AutoplayNext Action={Action} storage={storage} seriesId={seriesId} onPlayNext={onPlayNext} onDone={onExit} />
) : null}
```
und ein `useEffect`: `state === 'ended' && !seriesId` → `onExit()` (Film zu Ende → zurück).

`experience.tsx` player-Zweig: `seriesId={currentScreen.seriesId}` + 
```tsx
onPlayNext={(nextItemId) =>
  useScreenStore.getState().replace({ name: 'player', itemId: nextItemId, seriesId: currentScreen.seriesId })
}
```
(`key={currentScreen.itemId}` sorgt für Remount → alte Session wird via Cleanup gestoppt.)

- [ ] **Step 4: Verifizieren** — `pnpm test && pnpm typecheck && pnpm lint && pnpm --filter @lolarr/web build && pnpm --filter @lolarr/tv build` → grün. Smoke (Preview, ohne Server): Login-Screen bootet fehlerfrei; mit echter Instanz: Film abspielen, Episode + Autoplay, Resume-Round-Trip.

- [ ] **Step 5: Commit**

```bash
git add packages/features packages/ui
git commit -m "feat: playback entry points and autoplay next episode"
```

---

## Abschluss-Checkliste (nach Task 6)

- [ ] `pnpm test` (api + jellyfin + player) — grün; `pnpm typecheck && pnpm lint && pnpm build` — grün
- [ ] Manueller Smoke gegen echte Jellyfin-Instanz: (1) Film DirectPlay; (2) erzwungener Transcode (z. B. Browser ohne Codec) inkl. Transcode-Kill im Dashboard nach Stop; (3) Episode → Ende → Autoplay-Countdown → nächste Folge; (4) Resume-Round-Trip: abspielen → beenden → Home-Weiterschauen zeigt Fortschritt → Fortsetzen an Position; (5) Tastatur (Space/←/→/F/Esc)
- [ ] Spec-Abgleich: alle 5 Unit-Gruppen (DeviceProfile, Source-Wahl, ProgressReporter, Retry, Ticks) + jellyfin-URL/Payload-Tests vorhanden
