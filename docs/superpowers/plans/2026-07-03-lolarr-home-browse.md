# Lolarr Slice 2: Home/Browse mit echten Jellyfin-Daten — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home zeigt die eigene Jellyfin-Bibliothek (Hero=Weiterschauen, Resume/NextUp/Latest-Rows) vor den Discover-Rows; Jellyfin-Detail mit Staffeln/Episoden; Bilder direkt Client→Jellyfin.

**Architecture:** Ein `GET /api/home` aggregiert Jellyfin (User-Token aus DB) + Seerr-Discover (Admin-Key, 5-min-Cache) mit row-weiser Degradation via `Promise.allSettled`; Jellyfin-401 löst die bestehende 401-Kaskade aus. `MediaItem` bekommt ein optionales `jellyfin`-Unterobjekt (Ansatz A); neues Client-Package `@lolarr/jellyfin` baut Bild-URLs direkt gegen den Jellyfin-Server.

**Tech Stack:** Fastify 5, Zod 4, undici MockAgent (Tests), Vitest, React 19, @tanstack/react-query 5.

**Spec:** `docs/superpowers/specs/2026-07-03-lolarr-home-browse-design.md` — bei Widerspruch gewinnt die Spec.

## Global Constraints

- Bilder/Streams NIE durchs BFF proxien — Client baut Bild-URLs direkt (`{url}/Items/{id}/Images/{type}?tag=…&format=Webp&quality=90`, kein Token nötig).
- Jellyfin-User-Calls: Header via bestehendem `buildAuthorizationHeader`, DeviceId `lolarr-gateway`, User-Token aus `database.getJellyfinToken`; 401 → `JellyfinTokenInvalidError(userId)` (Kaskade existiert).
- Degradation: einzelne Jellyfin-Row scheitert → Row weglassen + warn-log; Jellyfin komplett down → Discover-only; Seerr down → Jellyfin-only; beide down → 502 `jellyfin_unreachable`.
- Limits exakt: Resume 12, NextUp 12, Latest 16/Library. Discover-Cache: 5 min in-memory, user-unabhängig.
- Repo-Regeln: erasableSyntaxOnly (keine TS-Parameter-Properties), ESM `.js`-Imports in apps/api + packages/jellyfin, `react-refresh`-Lint (begründete disables ok), UI-Texte englisch, Conventional Commits englisch.
- Nach jedem Task: `pnpm --filter @lolarr/api test && pnpm typecheck` grün (Frontend-Tasks zusätzlich `pnpm lint` + web/tv-Builds).
- ▶-Button im Library-Detail ist sichtbar aber disabled (Playback = Slice 3).

---

### Task 1: Domain-Erweiterung (jellyfin-Unterobjekt, Home-/Library-Schemas)

**Files:**
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/features/src/detail/DetailScreen.tsx` (tmdbId-Guard)
- Test: `apps/api/tests/domain-schemas.test.ts`

**Interfaces:**
- Produces (alle aus `@lolarr/domain`):
```ts
// mediaItemSchema: tmdbId wird optional; neues optionales Feld:
jellyfin: z.object({
  itemId: z.string(),
  imageTags: z.object({
    primary: z.string().optional(),
    backdrop: z.string().optional(),
    thumb: z.string().optional(),
  }),
  progressPercent: z.number().min(0).max(100).optional(),
  episode: z.object({
    seriesTitle: z.string(),
    season: z.number().int(),
    number: z.number().int(),
  }).optional(),
}).optional()

export const episodeSchema = z.object({
  id: z.string(),
  jellyfinItemId: z.string(),
  title: z.string(),
  seasonNumber: z.number().int(),
  episodeNumber: z.number().int(),
  overview: z.string(),
  runtimeMinutes: z.number().int().optional(),
  played: z.boolean(),
  imageTag: z.string().optional(),
})
export type Episode = z.infer<typeof episodeSchema>

export const seasonSchema = z.object({
  id: z.string(),
  name: z.string(),
  episodes: z.array(episodeSchema),
})
export type Season = z.infer<typeof seasonSchema>

export const homeResponseSchema = z.object({
  hero: mediaItemSchema.optional(),
  rows: z.array(mediaRowSchema),
})
export type HomeResponse = z.infer<typeof homeResponseSchema>

export const libraryDetailResponseSchema = z.object({
  item: mediaItemSchema,
  seasons: z.array(seasonSchema).optional(),
})
export type LibraryDetailResponse = z.infer<typeof libraryDetailResponseSchema>
```
- `mediaRequestSchema`/`createRequestSchema` behalten `tmdbId` **required** (Requests sind immer TMDB-basiert).

- [ ] **Step 1: Failing Test**

`apps/api/tests/domain-schemas.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { homeResponseSchema, mediaItemSchema } from '@lolarr/domain'

describe('domain schemas (slice 2)', () => {
  it('accepts a jellyfin item without tmdbId', () => {
    const item = mediaItemSchema.parse({
      id: 'jf-abc',
      mediaType: 'movie',
      title: 'The Matrix',
      overview: '',
      availability: 'available',
      jellyfin: {
        itemId: 'abc',
        imageTags: { primary: 'tag1' },
        progressPercent: 42,
      },
    })
    expect(item.tmdbId).toBeUndefined()
    expect(item.jellyfin?.itemId).toBe('abc')
  })

  it('accepts a discover item without jellyfin field (backwards compatible)', () => {
    const item = mediaItemSchema.parse({
      id: 'movie-1',
      mediaType: 'movie',
      title: 'Dune',
      overview: '',
      tmdbId: 693134,
      availability: 'requestable',
    })
    expect(item.jellyfin).toBeUndefined()
  })

  it('parses a home response with optional hero', () => {
    expect(homeResponseSchema.parse({ rows: [] }).hero).toBeUndefined()
  })
})
```

- [ ] **Step 2: Rot** — Run: `pnpm --filter @lolarr/api test tests/domain-schemas.test.ts` → FAIL (`homeResponseSchema` nicht exportiert; Item ohne tmdbId → ZodError).

- [ ] **Step 3: Implementieren**

In `packages/domain/src/index.ts`: `tmdbId: z.number().int().optional()` in `mediaItemSchema` (Zeile 24); das veraltete flache `jellyfinItemId`-Feld (Zeile 25) **löschen** (wird durch `jellyfin.itemId` ersetzt; grep bestätigt: einziger Setter war seerr.ts — dort nie befüllt); `jellyfin`-Objekt wie oben ergänzen. Neue Schemas (`episodeSchema`, `seasonSchema`, `homeResponseSchema`, `libraryDetailResponseSchema`) nach `mediaDetailResponseSchema` einfügen.

- [ ] **Step 4: Typecheck-Fallout beheben**

`tmdbId` optional macht `packages/features/src/detail/DetailScreen.tsx` rot (nutzt `item.tmdbId` im Query). Guard einziehen:
```tsx
const tmdbId = item.tmdbId
const detailQuery = useQuery({
  queryKey: ['media', apiBaseUrl, item.mediaType, tmdbId],
  queryFn: () => api.media(item.mediaType, tmdbId as number),
  enabled: tmdbId !== undefined,
})
```
(An die tatsächliche Struktur der Datei anpassen — Query-Key/Options unverändert lassen, nur den Guard ergänzen.) Ebenso jede weitere Stelle, die der Typecheck meldet (`useRequests`-CreateRequest nutzt `item.tmdbId` — dort denselben Guard: Request-Button ist für Items ohne tmdbId nie sichtbar, `if (item.tmdbId === undefined) return` am Mutations-Eingang).

- [ ] **Step 5: Grün** — Run: `pnpm --filter @lolarr/api test && pnpm typecheck` → PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/domain packages/features apps/api/tests/domain-schemas.test.ts
git commit -m "feat: extend domain with jellyfin sub-object and home/library schemas"
```

---

### Task 2: Jellyfin-Library-Adapter (User-Calls + Mapping)

**Files:**
- Modify: `apps/api/src/adapters/jellyfin.ts` (nur: `export`-Keyword vor `jellyfinFetch`)
- Create: `apps/api/src/adapters/jellyfinLibrary.ts`
- Test: `apps/api/tests/jellyfin-library.test.ts`

**Interfaces:**
- Consumes: `jellyfinFetch(config, path, { method, deviceId, token?, body? })` (jetzt exportiert), `JellyfinTokenInvalidError`, `UpstreamError`.
- Produces (aus `adapters/jellyfinLibrary.js`):
```ts
export type JellyfinUserAuth = { accessToken: string; userId: string; deviceId: string }
export type JellyfinView = { id: string; name: string; collectionType?: string }
export function mapJellyfinItem(raw: RawJellyfinItem): MediaItem
export async function getUserViews(config, auth): Promise<JellyfinView[]>
export async function getResumeItems(config, auth, limit: number): Promise<MediaItem[]>
export async function getNextUp(config, auth, limit: number): Promise<MediaItem[]>
export async function getLatestItems(config, auth, viewId: string, limit: number): Promise<MediaItem[]>
export async function getLibraryDetail(config, auth, itemId: string): Promise<LibraryDetailResponse | undefined> // undefined = 404
```

- [ ] **Step 1: Failing Test**

`apps/api/tests/jellyfin-library.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  getResumeItems,
  mapJellyfinItem,
  type JellyfinUserAuth,
} from '../src/adapters/jellyfinLibrary.js'
import { JellyfinTokenInvalidError } from '../src/lib/errors.js'
import { createTestContext } from './helpers.js'

const auth: JellyfinUserAuth = {
  accessToken: 'user-token',
  userId: 'jf-user-1',
  deviceId: 'lolarr-gateway',
}

describe('mapJellyfinItem', () => {
  it('maps a movie with tmdb provider id and progress', () => {
    const item = mapJellyfinItem({
      Id: 'abc',
      Name: 'The Matrix',
      Type: 'Movie',
      ProductionYear: 1999,
      Overview: 'Simulation.',
      ImageTags: { Primary: 'p1', Thumb: 't1' },
      BackdropImageTags: ['b1'],
      ProviderIds: { Tmdb: '603' },
      UserData: { PlayedPercentage: 42.5 },
    })
    expect(item).toMatchObject({
      id: 'jf-abc',
      mediaType: 'movie',
      title: 'The Matrix',
      year: 1999,
      tmdbId: 603,
      availability: 'available',
      jellyfin: {
        itemId: 'abc',
        imageTags: { primary: 'p1', backdrop: 'b1', thumb: 't1' },
        progressPercent: 42.5,
      },
    })
  })

  it('maps an episode with series context and no tmdb id', () => {
    const item = mapJellyfinItem({
      Id: 'ep1',
      Name: 'The Pointy End',
      Type: 'Episode',
      SeriesName: 'Game of Thrones',
      ParentIndexNumber: 1,
      IndexNumber: 8,
      ImageTags: { Primary: 'still1' },
    })
    expect(item.title).toBe('Game of Thrones')
    expect(item.mediaType).toBe('tv')
    expect(item.tmdbId).toBeUndefined()
    expect(item.jellyfin?.episode).toEqual({
      seriesTitle: 'Game of Thrones',
      season: 1,
      number: 8,
    })
  })
})

describe('getResumeItems', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('fetches and maps resume items with the user token', async () => {
    let seenAuth = ''
    ctx.jellyfin
      .intercept({
        path: /\/UserItems\/Resume.*/,
        method: 'GET',
        headers: (headers) => {
          seenAuth = headers.authorization ?? ''
          return true
        },
      })
      .reply(
        200,
        { Items: [{ Id: 'r1', Name: 'Movie', Type: 'Movie' }] },
        { headers: { 'content-type': 'application/json' } },
      )

    const items = await getResumeItems(ctx.config, auth, 12)
    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe('jf-r1')
    expect(seenAuth).toContain('Token="user-token"')
  })

  it('maps 401 to JellyfinTokenInvalidError with the user id', async () => {
    ctx.jellyfin
      .intercept({ path: /\/UserItems\/Resume.*/, method: 'GET' })
      .reply(401, {})
    await expect(getResumeItems(ctx.config, auth, 12)).rejects.toMatchObject({
      name: 'JellyfinTokenInvalidError',
      userId: 'jf-user-1',
    })
    await expect(getResumeItems(ctx.config, auth, 12)).rejects.toBeInstanceOf(
      JellyfinTokenInvalidError,
    )
  })
})
```
(Zweiter 401-Intercept nötig: single-shot — `.times(2)` am Intercept setzen oder zwei Intercepts registrieren.)

- [ ] **Step 2: Rot** — Run: `pnpm --filter @lolarr/api test tests/jellyfin-library.test.ts` → FAIL (Modul existiert nicht).

- [ ] **Step 3: Implementieren**

`apps/api/src/adapters/jellyfin.ts`: `async function jellyfinFetch` → `export async function jellyfinFetch` (sonst unverändert).

`apps/api/src/adapters/jellyfinLibrary.ts` (kompletter Inhalt):
```ts
import type { LibraryDetailResponse, MediaItem, Season } from '@lolarr/domain'
import type { AppConfig } from '../config.js'
import { JellyfinTokenInvalidError, UpstreamError } from '../lib/errors.js'
import { jellyfinFetch } from './jellyfin.js'

export type JellyfinUserAuth = {
  accessToken: string
  userId: string
  deviceId: string
}

export type JellyfinView = { id: string; name: string; collectionType?: string }

export type RawJellyfinItem = {
  Id: string
  Name: string
  Type?: string
  ProductionYear?: number
  Overview?: string
  ImageTags?: { Primary?: string; Thumb?: string }
  BackdropImageTags?: string[]
  ProviderIds?: { Tmdb?: string }
  UserData?: { PlayedPercentage?: number; Played?: boolean }
  SeriesName?: string
  ParentIndexNumber?: number
  IndexNumber?: number
  RunTimeTicks?: number
}

export function mapJellyfinItem(raw: RawJellyfinItem): MediaItem {
  const isEpisode = raw.Type === 'Episode'
  const tmdbRaw = raw.ProviderIds?.Tmdb
  const tmdbId = tmdbRaw ? Number.parseInt(tmdbRaw, 10) : undefined

  return {
    id: `jf-${raw.Id}`,
    mediaType: raw.Type === 'Movie' ? 'movie' : 'tv',
    title: isEpisode ? raw.SeriesName ?? raw.Name : raw.Name,
    year: raw.ProductionYear,
    overview: raw.Overview ?? '',
    tmdbId: Number.isFinite(tmdbId) ? tmdbId : undefined,
    availability: 'available',
    jellyfin: {
      itemId: raw.Id,
      imageTags: {
        primary: raw.ImageTags?.Primary,
        backdrop: raw.BackdropImageTags?.[0],
        thumb: raw.ImageTags?.Thumb,
      },
      progressPercent: raw.UserData?.PlayedPercentage,
      episode:
        isEpisode && raw.SeriesName && raw.ParentIndexNumber !== undefined && raw.IndexNumber !== undefined
          ? {
              seriesTitle: raw.SeriesName,
              season: raw.ParentIndexNumber,
              number: raw.IndexNumber,
            }
          : undefined,
    },
  }
}

export async function getUserViews(
  config: AppConfig,
  auth: JellyfinUserAuth,
): Promise<JellyfinView[]> {
  const payload = (await userFetch(
    config,
    auth,
    `/UserViews?userId=${encodeURIComponent(auth.userId)}`,
  )) as { Items?: Array<{ Id: string; Name: string; CollectionType?: string }> }

  return (payload.Items ?? []).map((view) => ({
    id: view.Id,
    name: view.Name,
    collectionType: view.CollectionType,
  }))
}

export async function getResumeItems(
  config: AppConfig,
  auth: JellyfinUserAuth,
  limit: number,
): Promise<MediaItem[]> {
  const payload = (await userFetch(
    config,
    auth,
    `/UserItems/Resume?userId=${encodeURIComponent(auth.userId)}&limit=${limit}&mediaTypes=Video&fields=Overview,ProviderIds`,
  )) as { Items?: RawJellyfinItem[] }
  return (payload.Items ?? []).map(mapJellyfinItem)
}

export async function getNextUp(
  config: AppConfig,
  auth: JellyfinUserAuth,
  limit: number,
): Promise<MediaItem[]> {
  const payload = (await userFetch(
    config,
    auth,
    `/Shows/NextUp?userId=${encodeURIComponent(auth.userId)}&limit=${limit}&fields=Overview,ProviderIds`,
  )) as { Items?: RawJellyfinItem[] }
  return (payload.Items ?? []).map(mapJellyfinItem)
}

export async function getLatestItems(
  config: AppConfig,
  auth: JellyfinUserAuth,
  viewId: string,
  limit: number,
): Promise<MediaItem[]> {
  const payload = (await userFetch(
    config,
    auth,
    `/Items/Latest?userId=${encodeURIComponent(auth.userId)}&parentId=${encodeURIComponent(viewId)}&limit=${limit}&fields=Overview,ProviderIds`,
  )) as RawJellyfinItem[]
  return (Array.isArray(payload) ? payload : []).map(mapJellyfinItem)
}

export async function getLibraryDetail(
  config: AppConfig,
  auth: JellyfinUserAuth,
  itemId: string,
): Promise<LibraryDetailResponse | undefined> {
  const response = await rawUserFetch(
    config,
    auth,
    `/Items/${encodeURIComponent(itemId)}?userId=${encodeURIComponent(auth.userId)}`,
  )
  if (response.status === 404) {
    return undefined
  }
  assertUserOk(response, auth, `/Items/${itemId}`)
  const raw = (await response.json()) as RawJellyfinItem

  const item = mapJellyfinItem(raw)
  if (raw.Type !== 'Series') {
    return { item }
  }

  const seasonsPayload = (await userFetch(
    config,
    auth,
    `/Shows/${encodeURIComponent(itemId)}/Seasons?userId=${encodeURIComponent(auth.userId)}`,
  )) as { Items?: Array<{ Id: string; Name: string }> }

  const seasons: Season[] = []
  for (const season of seasonsPayload.Items ?? []) {
    const episodesPayload = (await userFetch(
      config,
      auth,
      `/Shows/${encodeURIComponent(itemId)}/Episodes?userId=${encodeURIComponent(auth.userId)}&seasonId=${encodeURIComponent(season.Id)}&fields=Overview`,
    )) as { Items?: RawJellyfinItem[] }

    seasons.push({
      id: season.Id,
      name: season.Name,
      episodes: (episodesPayload.Items ?? []).map((episode) => ({
        id: `jf-${episode.Id}`,
        jellyfinItemId: episode.Id,
        title: episode.Name,
        seasonNumber: episode.ParentIndexNumber ?? 0,
        episodeNumber: episode.IndexNumber ?? 0,
        overview: episode.Overview ?? '',
        runtimeMinutes: episode.RunTimeTicks
          ? Math.round(episode.RunTimeTicks / 600_000_000)
          : undefined,
        played: episode.UserData?.Played === true,
        imageTag: episode.ImageTags?.Primary,
      })),
    })
  }

  return { item, seasons }
}

async function userFetch(config: AppConfig, auth: JellyfinUserAuth, path: string) {
  const response = await rawUserFetch(config, auth, path)
  assertUserOk(response, auth, path)
  return response.json() as Promise<unknown>
}

async function rawUserFetch(config: AppConfig, auth: JellyfinUserAuth, path: string) {
  return jellyfinFetch(config, path, {
    method: 'GET',
    deviceId: auth.deviceId,
    token: auth.accessToken,
  })
}

function assertUserOk(response: Response, auth: JellyfinUserAuth, path: string) {
  if (response.status === 401) {
    throw new JellyfinTokenInvalidError(auth.userId)
  }
  if (!response.ok) {
    throw new UpstreamError('jellyfin', response.status, `Jellyfin request failed: ${path}`)
  }
}
```

- [ ] **Step 4: Grün** — Run: `pnpm --filter @lolarr/api test && pnpm typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: jellyfin library adapter with user-scoped calls and item mapping"
```

---

### Task 3: Discover-Cache (5 min) im SeerrAdapter

**Files:**
- Modify: `apps/api/src/adapters/seerr.ts`
- Test: `apps/api/tests/seerr-discover-cache.test.ts`

**Interfaces:**
- Produces: `SeerrAdapter.discover()` cached 5 min in-memory (user-unabhängig). Öffentliche Signatur unverändert. Konstruktor unverändert.

- [ ] **Step 1: Failing Test**

`apps/api/tests/seerr-discover-cache.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SeerrAdapter } from '../src/adapters/seerr.js'
import { SeerrSessionService } from '../src/services/seerrSession.js'
import { LolarrDatabase } from '../src/services/database.js'
import { createTestContext } from './helpers.js'

describe('SeerrAdapter discover cache', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('serves the second discover call from cache (single upstream round-trip)', async () => {
    // single-shot Intercepts: ein zweiter Upstream-Call würde mit
    // "no matching interceptor" fehlschlagen (disableNetConnect)
    for (const path of ['/api/v1/discover/trending', '/api/v1/discover/movies', '/api/v1/discover/tv']) {
      ctx.seerr
        .intercept({ path, method: 'GET' })
        .reply(200, { results: [{ id: 1, mediaType: 'movie', title: 'Dune' }] }, { headers: { 'content-type': 'application/json' } })
    }

    const database = new LolarrDatabase(ctx.config.LOLARR_DATABASE_PATH, ctx.config.LOLARR_SECRET)
    const seerr = new SeerrAdapter(ctx.config, new SeerrSessionService(ctx.config, database))

    const first = await seerr.discover()
    const second = await seerr.discover()
    expect(second).toEqual(first)
    expect(first.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Rot** — Run: `pnpm --filter @lolarr/api test tests/seerr-discover-cache.test.ts` → FAIL (zweiter Call trifft Upstream → kein Intercept mehr → Fehler).

- [ ] **Step 3: Implementieren**

In `SeerrAdapter` (Felder + `discover()` anpassen; erasableSyntaxOnly beachten — explizite Felddeklaration):
```ts
const DISCOVER_CACHE_TTL_MS = 5 * 60 * 1000

// Felder:
private discoverCache: { rows: MediaRow[]; fetchedAt: number } | undefined

// discover():
async discover(): Promise<MediaRow[]> {
  if (this.discoverCache && Date.now() - this.discoverCache.fetchedAt < DISCOVER_CACHE_TTL_MS) {
    return this.discoverCache.rows
  }

  const [trending, movies, shows] = await Promise.all([
    this.fetchList('/api/v1/discover/trending'),
    this.fetchList('/api/v1/discover/movies'),
    this.fetchList('/api/v1/discover/tv'),
  ])

  const rows = [
    { id: 'trending', title: 'Trending now', items: trending },
    { id: 'popular-movies', title: 'Popular movies', items: movies },
    { id: 'popular-shows', title: 'Popular series', items: shows },
  ].filter((row) => row.items.length > 0)

  this.discoverCache = { rows, fetchedAt: Date.now() }
  return rows
}
```

- [ ] **Step 4: Grün** — Run: `pnpm --filter @lolarr/api test` → PASS (bestehende Tests, die discover mehrfach mocken, prüfen: `auth-hook.test.ts` mockt discover mit `.times(3)` einmal pro Test — Cache ist pro Adapter-Instanz = pro `createServer`, Tests bauen je eigene Server → unbeeinflusst).

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: cache seerr discover rows for five minutes"
```

---

### Task 4: `GET /api/home` (Aggregation + Degradation + Hero)

**Files:**
- Create: `apps/api/src/modules/home.ts`
- Modify: `apps/api/src/server.ts` (registrieren)
- Modify: `apps/api/tests/helpers.ts` (Login-Helper)
- Test: `apps/api/tests/home.test.ts`

**Interfaces:**
- Consumes: Task-2-Funktionen, `seerr.discover()`, `database.getJellyfinToken`, `request.session`.
- Produces: `homeRoutes: (app, context: AppContext) => Promise<void>`; Response = `HomeResponse`. Test-Helper `loginTestUser(app, ctx): Promise<{ token: string }>`.

- [ ] **Step 1: Login-Helper in `tests/helpers.ts` ergänzen**

```ts
import type { FastifyInstance } from 'fastify'

export async function loginTestUser(app: FastifyInstance, ctx: ReturnType<typeof createTestContext>) {
  ctx.jellyfin
    .intercept({ path: '/Users/AuthenticateByName', method: 'POST' })
    .reply(200, jellyfinAuthResponse(), { headers: { 'content-type': 'application/json' } })

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'joel', password: 'pw', deviceId: 'device-12345' },
  })
  return response.json() as { token: string }
}
```
(Seerr-Login-Intercept nicht nötig — Fehlschlag ist non-fatal.)

- [ ] **Step 2: Failing Tests**

`apps/api/tests/home.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../src/server.js'
import { createTestContext, loginTestUser } from './helpers.js'

const JSON_HEADERS = { headers: { 'content-type': 'application/json' } }

function mockJellyfinHome(ctx: ReturnType<typeof createTestContext>) {
  ctx.jellyfin
    .intercept({ path: /\/UserItems\/Resume.*/, method: 'GET' })
    .reply(200, { Items: [{ Id: 'r1', Name: 'Resumed Movie', Type: 'Movie', UserData: { PlayedPercentage: 40 } }] }, JSON_HEADERS)
  ctx.jellyfin
    .intercept({ path: /\/Shows\/NextUp.*/, method: 'GET' })
    .reply(200, { Items: [{ Id: 'n1', Name: 'Next Episode', Type: 'Episode', SeriesName: 'Some Show', ParentIndexNumber: 2, IndexNumber: 3 }] }, JSON_HEADERS)
  ctx.jellyfin
    .intercept({ path: /\/UserViews.*/, method: 'GET' })
    .reply(200, { Items: [{ Id: 'lib1', Name: 'Movies', CollectionType: 'movies' }] }, JSON_HEADERS)
  ctx.jellyfin
    .intercept({ path: /\/Items\/Latest.*/, method: 'GET' })
    .reply(200, [{ Id: 'l1', Name: 'Fresh Movie', Type: 'Movie' }], JSON_HEADERS)
}

function mockSeerrDiscover(ctx: ReturnType<typeof createTestContext>) {
  ctx.seerr
    .intercept({ path: /\/api\/v1\/discover\/.*/, method: 'GET' })
    .reply(200, { results: [{ id: 550, mediaType: 'movie', title: 'Fight Club' }] }, JSON_HEADERS)
    .times(3)
}

describe('GET /api/home', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('returns library rows before discover rows with a resume hero', async () => {
    const app = createServer(ctx.config)
    const { token } = await loginTestUser(app, ctx)
    mockJellyfinHome(ctx)
    mockSeerrDiscover(ctx)

    const response = await app.inject({
      method: 'GET',
      url: '/api/home',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.hero.id).toBe('jf-r1')
    const rowIds = body.rows.map((row: { id: string }) => row.id)
    expect(rowIds[0]).toBe('continue-watching')
    expect(rowIds[1]).toBe('latest-lib1')
    expect(rowIds).toContain('trending')
    expect(rowIds.indexOf('latest-lib1')).toBeLessThan(rowIds.indexOf('trending'))
    // continue-watching = Resume + NextUp gemergt
    const cw = body.rows[0]
    expect(cw.items.map((i: { id: string }) => i.id)).toEqual(['jf-r1', 'jf-n1'])
  })

  it('falls back to a discover hero when nothing is in progress', async () => {
    const app = createServer(ctx.config)
    const { token } = await loginTestUser(app, ctx)
    ctx.jellyfin.intercept({ path: /\/UserItems\/Resume.*/, method: 'GET' }).reply(200, { Items: [] }, JSON_HEADERS)
    ctx.jellyfin.intercept({ path: /\/Shows\/NextUp.*/, method: 'GET' }).reply(200, { Items: [] }, JSON_HEADERS)
    ctx.jellyfin.intercept({ path: /\/UserViews.*/, method: 'GET' }).reply(200, { Items: [] }, JSON_HEADERS)
    mockSeerrDiscover(ctx)

    const response = await app.inject({ method: 'GET', url: '/api/home', headers: { authorization: `Bearer ${token}` } })
    const body = response.json()
    expect(body.hero.tmdbId).toBe(550)
    expect(body.hero.jellyfin).toBeUndefined()
  })

  it('degrades to discover-only when jellyfin is down', async () => {
    const app = createServer(ctx.config)
    const { token } = await loginTestUser(app, ctx)
    ctx.jellyfin.intercept({ path: /\/UserItems\/Resume.*/, method: 'GET' }).reply(500, {})
    ctx.jellyfin.intercept({ path: /\/Shows\/NextUp.*/, method: 'GET' }).reply(500, {})
    ctx.jellyfin.intercept({ path: /\/UserViews.*/, method: 'GET' }).reply(500, {})
    mockSeerrDiscover(ctx)

    const response = await app.inject({ method: 'GET', url: '/api/home', headers: { authorization: `Bearer ${token}` } })
    expect(response.statusCode).toBe(200)
    const rowIds = response.json().rows.map((row: { id: string }) => row.id)
    expect(rowIds).toEqual(['trending'])
  })

  it('degrades to jellyfin-only when seerr is down', async () => {
    const app = createServer(ctx.config)
    const { token } = await loginTestUser(app, ctx)
    mockJellyfinHome(ctx)
    ctx.seerr.intercept({ path: /\/api\/v1\/discover\/.*/, method: 'GET' }).reply(503, {}).times(3)

    const response = await app.inject({ method: 'GET', url: '/api/home', headers: { authorization: `Bearer ${token}` } })
    expect(response.statusCode).toBe(200)
    const rowIds = response.json().rows.map((row: { id: string }) => row.id)
    expect(rowIds).toEqual(['continue-watching', 'latest-lib1'])
  })

  it('returns 502 when both sources are down', async () => {
    const app = createServer(ctx.config)
    const { token } = await loginTestUser(app, ctx)
    ctx.jellyfin.intercept({ path: /\/UserItems\/Resume.*/, method: 'GET' }).reply(500, {})
    ctx.jellyfin.intercept({ path: /\/Shows\/NextUp.*/, method: 'GET' }).reply(500, {})
    ctx.jellyfin.intercept({ path: /\/UserViews.*/, method: 'GET' }).reply(500, {})
    ctx.seerr.intercept({ path: /\/api\/v1\/discover\/.*/, method: 'GET' }).reply(503, {}).times(3)

    const response = await app.inject({ method: 'GET', url: '/api/home', headers: { authorization: `Bearer ${token}` } })
    expect(response.statusCode).toBe(502)
    expect(response.json().error).toBe('jellyfin_unreachable')
  })

  it('triggers the 401 cascade when the jellyfin token is rejected', async () => {
    const app = createServer(ctx.config)
    const { token } = await loginTestUser(app, ctx)
    ctx.jellyfin.intercept({ path: /\/UserItems\/Resume.*/, method: 'GET' }).reply(401, {})
    ctx.jellyfin.intercept({ path: /\/Shows\/NextUp.*/, method: 'GET' }).reply(401, {})
    ctx.jellyfin.intercept({ path: /\/UserViews.*/, method: 'GET' }).reply(401, {})
    mockSeerrDiscover(ctx)

    const response = await app.inject({ method: 'GET', url: '/api/home', headers: { authorization: `Bearer ${token}` } })
    expect(response.statusCode).toBe(401)
    expect(response.json().error).toBe('session_expired')

    const followUp = await app.inject({ method: 'GET', url: '/api/home', headers: { authorization: `Bearer ${token}` } })
    expect(followUp.statusCode).toBe(401)
  })
})
```

- [ ] **Step 3: Rot** — Run: `pnpm --filter @lolarr/api test tests/home.test.ts` → FAIL (Route existiert nicht → 404).

- [ ] **Step 4: Implementieren**

`apps/api/src/modules/home.ts`:
```ts
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { MediaItem, MediaRow } from '@lolarr/domain'
import type { AppContext } from '../lib/context.js'
import { JellyfinTokenInvalidError, UpstreamError } from '../lib/errors.js'
import {
  getLatestItems,
  getNextUp,
  getResumeItems,
  getUserViews,
  type JellyfinUserAuth,
} from '../adapters/jellyfinLibrary.js'

const GATEWAY_DEVICE_ID = 'lolarr-gateway'
const RESUME_LIMIT = 12
const NEXT_UP_LIMIT = 12
const LATEST_LIMIT = 16
const CONTINUE_WATCHING_LIMIT = 12

export async function homeRoutes(app: FastifyInstance, { config, database, seerr }: AppContext) {
  app.get('/api/home', async (request) => {
    const userId = request.session.user.id
    const accessToken = database.getJellyfinToken(userId)
    if (!accessToken) {
      throw new JellyfinTokenInvalidError(userId)
    }
    const auth: JellyfinUserAuth = { accessToken, userId, deviceId: GATEWAY_DEVICE_ID }

    const [resume, nextUp, views, discover] = await Promise.allSettled([
      getResumeItems(config, auth, RESUME_LIMIT),
      getNextUp(config, auth, NEXT_UP_LIMIT),
      getUserViews(config, auth),
      seerr.discover(),
    ])
    rethrowTokenInvalid([resume, nextUp, views])

    const latestRows = await buildLatestRows(request, config, auth, views)

    const continueWatching = mergeContinueWatching(
      settledValue(resume) ?? [],
      settledValue(nextUp) ?? [],
    )

    const rows: MediaRow[] = []
    if (continueWatching.length > 0) {
      rows.push({ id: 'continue-watching', title: 'Continue watching', items: continueWatching })
    }
    rows.push(...latestRows)
    const discoverRows = settledValue(discover) ?? []
    rows.push(...discoverRows)

    const jellyfinDown =
      resume.status === 'rejected' && nextUp.status === 'rejected' && views.status === 'rejected'
    if (jellyfinDown && discover.status === 'rejected') {
      throw new UpstreamError('jellyfin', undefined, 'home sources unavailable')
    }
    logRejections(request, { resume, nextUp, views, discover })

    const hero = continueWatching[0] ?? discoverRows[0]?.items[0]
    return { hero, rows }
  })
}

async function buildLatestRows(
  request: FastifyRequest,
  config: AppContext['config'],
  auth: JellyfinUserAuth,
  views: PromiseSettledResult<Awaited<ReturnType<typeof getUserViews>>>,
): Promise<MediaRow[]> {
  if (views.status !== 'fulfilled') {
    return []
  }

  const libraries = views.value.filter(
    (view) => view.collectionType === 'movies' || view.collectionType === 'tvshows',
  )
  const results = await Promise.allSettled(
    libraries.map((library) => getLatestItems(config, auth, library.id, LATEST_LIMIT)),
  )

  const rows: MediaRow[] = []
  results.forEach((result, index) => {
    const library = libraries[index]
    if (!library) {
      return
    }
    if (result.status === 'rejected') {
      if (result.reason instanceof JellyfinTokenInvalidError) {
        throw result.reason
      }
      request.log.warn({ err: result.reason, library: library.name }, 'home latest row failed')
      return
    }
    if (result.value.length > 0) {
      rows.push({ id: `latest-${library.id}`, title: `New in ${library.name}`, items: result.value })
    }
  })
  return rows
}

// Resume zuerst (Server sortiert nach zuletzt gespielt), dann NextUp-Folgen,
// deren Serie nicht schon in Resume steckt. Bewusste Vereinfachung gegenüber
// Wholphins Last-Played-Lookup-Merge.
function mergeContinueWatching(resume: MediaItem[], nextUp: MediaItem[]): MediaItem[] {
  const seenTitles = new Set(resume.map((item) => item.title))
  const merged = [...resume]
  for (const item of nextUp) {
    if (!seenTitles.has(item.title)) {
      merged.push(item)
      seenTitles.add(item.title)
    }
  }
  return merged.slice(0, CONTINUE_WATCHING_LIMIT)
}

function rethrowTokenInvalid(results: Array<PromiseSettledResult<unknown>>) {
  for (const result of results) {
    if (result.status === 'rejected' && result.reason instanceof JellyfinTokenInvalidError) {
      throw result.reason
    }
  }
}

function settledValue<T>(result: PromiseSettledResult<T>): T | undefined {
  return result.status === 'fulfilled' ? result.value : undefined
}

function logRejections(
  request: FastifyRequest,
  results: Record<string, PromiseSettledResult<unknown>>,
) {
  for (const [name, result] of Object.entries(results)) {
    if (result.status === 'rejected') {
      request.log.warn({ err: result.reason, source: name }, 'home source degraded')
    }
  }
}
```

`apps/api/src/server.ts`: `import { homeRoutes } from './modules/home.js'` + `app.register(homeRoutes, context)` neben den anderen Modulen.

- [ ] **Step 5: Grün** — Run: `pnpm --filter @lolarr/api test && pnpm typecheck` → PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat: aggregate home feed from jellyfin library and seerr discover"
```

---

### Task 5: `GET /api/library/:itemId`

**Files:**
- Create: `apps/api/src/modules/library.ts`
- Modify: `apps/api/src/server.ts` (registrieren)
- Test: `apps/api/tests/library.test.ts`

**Interfaces:**
- Consumes: `getLibraryDetail` (Task 2), `database.getJellyfinToken`.
- Produces: `libraryRoutes`; Response `LibraryDetailResponse` | 404 `{ error: 'Item not found' }`.

- [ ] **Step 1: Failing Test**

`apps/api/tests/library.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../src/server.js'
import { createTestContext, loginTestUser } from './helpers.js'

const JSON_HEADERS = { headers: { 'content-type': 'application/json' } }

describe('GET /api/library/:itemId', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('returns a movie without seasons', async () => {
    const app = createServer(ctx.config)
    const { token } = await loginTestUser(app, ctx)
    ctx.jellyfin
      .intercept({ path: /\/Items\/movie-1\?.*/, method: 'GET' })
      .reply(200, { Id: 'movie-1', Name: 'The Matrix', Type: 'Movie', ProductionYear: 1999 }, JSON_HEADERS)

    const response = await app.inject({ method: 'GET', url: '/api/library/movie-1', headers: { authorization: `Bearer ${token}` } })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.item.id).toBe('jf-movie-1')
    expect(body.seasons).toBeUndefined()
  })

  it('returns a series with seasons and episodes incl. played state', async () => {
    const app = createServer(ctx.config)
    const { token } = await loginTestUser(app, ctx)
    ctx.jellyfin
      .intercept({ path: /\/Items\/series-1\?.*/, method: 'GET' })
      .reply(200, { Id: 'series-1', Name: 'Some Show', Type: 'Series' }, JSON_HEADERS)
    ctx.jellyfin
      .intercept({ path: /\/Shows\/series-1\/Seasons.*/, method: 'GET' })
      .reply(200, { Items: [{ Id: 's1', Name: 'Season 1' }] }, JSON_HEADERS)
    ctx.jellyfin
      .intercept({ path: /\/Shows\/series-1\/Episodes.*/, method: 'GET' })
      .reply(200, {
        Items: [{
          Id: 'e1', Name: 'Pilot', ParentIndexNumber: 1, IndexNumber: 1,
          RunTimeTicks: 36_000_000_000, UserData: { Played: true },
        }],
      }, JSON_HEADERS)

    const response = await app.inject({ method: 'GET', url: '/api/library/series-1', headers: { authorization: `Bearer ${token}` } })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.seasons).toHaveLength(1)
    expect(body.seasons[0].episodes[0]).toMatchObject({
      title: 'Pilot',
      seasonNumber: 1,
      episodeNumber: 1,
      runtimeMinutes: 60,
      played: true,
    })
  })

  it('returns 404 for unknown items', async () => {
    const app = createServer(ctx.config)
    const { token } = await loginTestUser(app, ctx)
    ctx.jellyfin
      .intercept({ path: /\/Items\/nope\?.*/, method: 'GET' })
      .reply(404, {})

    const response = await app.inject({ method: 'GET', url: '/api/library/nope', headers: { authorization: `Bearer ${token}` } })
    expect(response.statusCode).toBe(404)
    expect(response.json().error).toBe('Item not found')
  })
})
```

- [ ] **Step 2: Rot** — Run: `pnpm --filter @lolarr/api test tests/library.test.ts` → FAIL (404 vom Router statt Handler).

- [ ] **Step 3: Implementieren**

`apps/api/src/modules/library.ts`:
```ts
import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../lib/context.js'
import { JellyfinTokenInvalidError } from '../lib/errors.js'
import { getLibraryDetail, type JellyfinUserAuth } from '../adapters/jellyfinLibrary.js'

const GATEWAY_DEVICE_ID = 'lolarr-gateway'

export async function libraryRoutes(app: FastifyInstance, { config, database }: AppContext) {
  app.get('/api/library/:itemId', async (request, reply) => {
    const params = request.params as { itemId?: string }
    if (!params.itemId) {
      return reply.code(400).send({ error: 'Invalid item id' })
    }

    const userId = request.session.user.id
    const accessToken = database.getJellyfinToken(userId)
    if (!accessToken) {
      throw new JellyfinTokenInvalidError(userId)
    }
    const auth: JellyfinUserAuth = { accessToken, userId, deviceId: GATEWAY_DEVICE_ID }

    const detail = await getLibraryDetail(config, auth, params.itemId)
    if (!detail) {
      return reply.code(404).send({ error: 'Item not found' })
    }
    return detail
  })
}
```
`server.ts`: `app.register(libraryRoutes, context)` ergänzen.

- [ ] **Step 4: Grün** — Run: `pnpm --filter @lolarr/api test && pnpm typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: library detail endpoint with seasons and episodes"
```

---

### Task 6: packages/jellyfin (Session-Reader + Bild-URL-Builder)

**Files:**
- Create: `packages/jellyfin/package.json`, `packages/jellyfin/tsconfig.json`, `packages/jellyfin/moon.yml`, `packages/jellyfin/vitest.config.ts`
- Create: `packages/jellyfin/src/index.ts`
- Test: `packages/jellyfin/tests/index.test.ts`

**Interfaces:**
- Produces (aus `@lolarr/jellyfin`):
```ts
export type SessionStorageReader = { get(key: string): string | null }
export function readJellyfinSession(storage: SessionStorageReader): JellyfinSession | null
export type JellyfinImageType = 'Primary' | 'Backdrop' | 'Thumb'
export function buildImageUrl(
  session: JellyfinSession,
  itemId: string,
  type: JellyfinImageType,
  tag: string,
  opts?: { width?: number; quality?: number },
): string
```

- [ ] **Step 1: Package-Gerüst**

`packages/jellyfin/package.json`:
```json
{
  "name": "@lolarr/jellyfin",
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
  "dependencies": { "@lolarr/domain": "workspace:*" },
  "devDependencies": { "vitest": "^3" }
}
```
`tsconfig.json` und `moon.yml`: 1:1 von `packages/domain` kopieren (moon.yml: Projektname auf `jellyfin` anpassen — Datei vorher lesen). `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
})
```
Dann `pnpm install` (Workspace-Link).

- [ ] **Step 2: Failing Test**

`packages/jellyfin/tests/index.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { buildImageUrl, readJellyfinSession } from '../src/index.js'

const session = {
  url: 'http://jellyfin.test',
  accessToken: 'tok',
  userId: 'u1',
  deviceId: 'd1',
}

function storageWith(value: string | null) {
  return { get: () => value }
}

describe('readJellyfinSession', () => {
  it('returns a valid stored session', () => {
    expect(readJellyfinSession(storageWith(JSON.stringify(session)))).toEqual(session)
  })

  it.each([
    ['missing', null],
    ['not json', '{nope'],
    ['wrong shape', JSON.stringify({ url: 'x' })],
  ])('returns null for %s values', (_label, value) => {
    expect(readJellyfinSession(storageWith(value))).toBeNull()
  })
})

describe('buildImageUrl', () => {
  it('builds a primary image url with defaults', () => {
    const url = buildImageUrl(session, 'abc', 'Primary', 'tag1')
    expect(url).toBe('http://jellyfin.test/Items/abc/Images/Primary?tag=tag1&format=Webp&quality=90')
  })

  it('applies width and quality options', () => {
    const url = buildImageUrl(session, 'abc', 'Backdrop', 'tag2', { width: 1280, quality: 80 })
    expect(url).toContain('fillWidth=1280')
    expect(url).toContain('quality=80')
    expect(url).toContain('/Images/Backdrop?')
  })
})
```

- [ ] **Step 3: Rot** — Run: `pnpm --filter @lolarr/jellyfin test` → FAIL (Modul leer/fehlt).

- [ ] **Step 4: Implementieren**

`packages/jellyfin/src/index.ts`:
```ts
import { jellyfinSessionSchema, type JellyfinSession } from '@lolarr/domain'

const jellyfinStorageKey = 'lolarr.jellyfin'

export type SessionStorageReader = { get(key: string): string | null }

export function readJellyfinSession(storage: SessionStorageReader): JellyfinSession | null {
  const raw = storage.get(jellyfinStorageKey)
  if (!raw) {
    return null
  }

  try {
    const parsed = jellyfinSessionSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export type JellyfinImageType = 'Primary' | 'Backdrop' | 'Thumb'

export function buildImageUrl(
  session: JellyfinSession,
  itemId: string,
  type: JellyfinImageType,
  tag: string,
  opts: { width?: number; quality?: number } = {},
): string {
  const params = new URLSearchParams({ tag, format: 'Webp', quality: String(opts.quality ?? 90) })
  if (opts.width) {
    params.set('fillWidth', String(opts.width))
  }
  return `${session.url}/Items/${encodeURIComponent(itemId)}/Images/${type}?${params.toString()}`
}
```

- [ ] **Step 5: Grün** — Run: `pnpm --filter @lolarr/jellyfin test && pnpm typecheck && pnpm lint` → PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/jellyfin pnpm-lock.yaml
git commit -m "feat: jellyfin client package with session reader and image url builder"
```

---

### Task 7: Home-Umbau im Frontend (useHome, Bild-Auflösung, Progress/Hero)

**Files:**
- Modify: `packages/api-client/src/index.ts` (+`home()`)
- Modify: `packages/features/package.json` (+`@lolarr/jellyfin`)
- Create: `packages/features/src/home/useHome.ts`
- Create: `packages/features/src/lib/images.ts`
- Modify: `packages/features/src/home/HomeScreen.tsx`
- Modify: `packages/ui/src/components/MediaPosterButton.tsx`, `packages/ui/src/components/HeroPanel.tsx`
- Modify: `packages/ui/src/styles.css`

**Interfaces:**
- Consumes: `HomeResponse` (Task 1), `readJellyfinSession`/`buildImageUrl` (Task 6), `KeyValueStorage` (features/storage).
- Produces:
```ts
// api-client:
home() { return request<HomeResponse>('/api/home') },
// features:
export function useHome(options: { apiBaseUrl: string }): UseQueryResult<HomeResponse>
export function resolveItemImages(item: MediaItem, session: JellyfinSession | null): { posterUrl?: string; backdropUrl?: string }
export function enrichItems(items: MediaItem[], session: JellyfinSession | null): MediaItem[]  // Kopien mit aufgelösten URLs
```
- `HomeScreen` erhält neue Prop `storage: KeyValueStorage` (durchgereicht von `experience.tsx`).

- [ ] **Step 1: api-client + Hook + Bild-Helper**

`packages/api-client/src/index.ts`: `HomeResponse` importieren, Methode ergänzen:
```ts
home() {
  return request<HomeResponse>('/api/home')
},
```

`packages/features/src/home/useHome.ts`:
```ts
import { useQuery } from '@tanstack/react-query'
import { useApi } from '../api.js'

export function useHome({ apiBaseUrl }: { apiBaseUrl: string }) {
  const api = useApi()
  return useQuery({
    queryKey: ['home', apiBaseUrl],
    queryFn: () => api.home(),
  })
}
```

`packages/features/src/lib/images.ts`:
```ts
import type { JellyfinSession, MediaItem } from '@lolarr/domain'
import { buildImageUrl } from '@lolarr/jellyfin'

export function resolveItemImages(
  item: MediaItem,
  session: JellyfinSession | null,
): { posterUrl?: string; backdropUrl?: string } {
  if (!item.jellyfin || !session) {
    return { posterUrl: item.posterUrl, backdropUrl: item.backdropUrl }
  }

  const { itemId, imageTags } = item.jellyfin
  return {
    posterUrl: imageTags.primary
      ? buildImageUrl(session, itemId, 'Primary', imageTags.primary, { width: 400 })
      : item.posterUrl,
    backdropUrl: imageTags.backdrop
      ? buildImageUrl(session, itemId, 'Backdrop', imageTags.backdrop, { width: 1280 })
      : item.backdropUrl,
  }
}

export function enrichItems(items: MediaItem[], session: JellyfinSession | null): MediaItem[] {
  return items.map((item) => ({ ...item, ...resolveItemImages(item, session) }))
}
```
`packages/features/package.json`: `"@lolarr/jellyfin": "workspace:*"` unter dependencies; `pnpm install`.

- [ ] **Step 2: HomeScreen umbauen**

`packages/features/src/home/HomeScreen.tsx` — Änderungen (Struktur der Datei beibehalten):
- Neue Prop `storage: KeyValueStorage`; `experience.tsx` reicht `storage` durch (Prop existiert dort).
- `discoverQuery` → `const homeQuery = useHome({ apiBaseUrl })` (Import `useHome`).
- Jellyfin-Session einmal lesen: `const jellyfinSession = useMemo(() => readJellyfinSession(storage), [storage])` (Import aus `@lolarr/jellyfin`; `KeyValueStorage` erfüllt `SessionStorageReader` strukturell).
- Rows: Suche unverändert; sonst `homeQuery.data?.rows ?? []`, jede Row via `enrichItems(row.items, jellyfinSession)`:
```tsx
const rows = deferredQuery && searchQuery.data
  ? [{ id: 'search-results', title: `Search results for "${deferredQuery}"`, items: searchQuery.data.results }]
  : (homeQuery.data?.rows ?? []).map((row) => ({ ...row, items: enrichItems(row.items, jellyfinSession) }))
const heroSource = homeQuery.data?.hero
const featuredItem = heroSource
  ? { ...heroSource, ...resolveItemImages(heroSource, jellyfinSession) }
  : rows[0]?.items[0]
const error = homeQuery.error ?? searchQuery.error ?? requestsError
```
- Loading-Bedingung: `homeQuery.isLoading || searchQuery.isLoading`.

- [ ] **Step 3: UI — Progress-Balken, Episode-Label, Hero-Badge**

`packages/ui/src/components/MediaPosterButton.tsx` (Struktur der Datei zuerst lesen, dann): unter dem Poster-Bild ergänzen —
```tsx
{item.jellyfin?.progressPercent !== undefined ? (
  <span className="poster-progress" aria-hidden="true">
    <span className="poster-progress-fill" style={{ width: `${item.jellyfin.progressPercent}%` }} />
  </span>
) : null}
{item.jellyfin?.episode ? (
  <span className="poster-subtitle">{`S${item.jellyfin.episode.season} · E${item.jellyfin.episode.number}`}</span>
) : null}
```

`packages/ui/src/components/HeroPanel.tsx`: wenn `item.jellyfin?.progressPercent !== undefined || item.jellyfin?.episode` → Badge `<span className="hero-badge">Continue watching</span>` über dem Titel; bei Episode zusätzlich Untertitel `{item.jellyfin.episode.seriesTitle} · S… · E…` — konkrete Platzierung an der bestehenden JSX-Struktur ausrichten.

`packages/ui/src/styles.css` anhängen:
```css
.poster-progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 4px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 0 0 8px 8px;
  overflow: hidden;
}

.poster-progress-fill {
  display: block;
  height: 100%;
  background: #e50914;
}

.poster-subtitle {
  display: block;
  font-size: 0.75rem;
  opacity: 0.75;
  margin-top: 0.25rem;
}

.hero-badge {
  display: inline-block;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  background: rgba(229, 9, 20, 0.85);
  margin-bottom: 0.5rem;
}
```
(Falls `.media-poster`/Kachel-Container kein `position: relative` hat: ergänzen.)

- [ ] **Step 4: Verifizieren**

Run: `pnpm typecheck && pnpm lint && pnpm --filter @lolarr/web build && pnpm --filter @lolarr/tv build && pnpm --filter @lolarr/api test`
Expected: alles grün. Smoke: `pnpm dev:web` — Home lädt (mit konfiguriertem Backend echte Rows; Fehlerfall zeigt ErrorPanel, kein Crash bei fehlender `lolarr.jellyfin`).

- [ ] **Step 5: Commit**

```bash
git add packages/api-client packages/features packages/ui pnpm-lock.yaml
git commit -m "feat: home screen renders jellyfin library rows with direct image urls"
```

---

### Task 8: LibraryDetailScreen + Navigation

**Files:**
- Modify: `packages/api-client/src/index.ts` (+`libraryDetail()`)
- Modify: `packages/features/src/navigation/store.ts` (Screen-Union)
- Modify: `packages/features/src/experience.tsx` (Routing per `item.jellyfin`)
- Create: `packages/features/src/library/useLibraryDetail.ts`, `packages/features/src/library/LibraryDetailScreen.tsx`
- Create: `packages/ui/src/components/EpisodeList.tsx`, `packages/ui/src/components/SeasonSelector.tsx`
- Modify: `packages/ui/src/index.ts`, `packages/ui/src/styles.css`

**Interfaces:**
- Consumes: `LibraryDetailResponse`/`Season`/`Episode` (Task 1), `resolveItemImages` (Task 7), `readJellyfinSession`.
- Produces:
```ts
// api-client:
libraryDetail(itemId: string) {
  return request<LibraryDetailResponse>(`/api/library/${encodeURIComponent(itemId)}`)
},
// navigation:
export type Screen =
  | { name: 'home' }
  | { name: 'detail'; item: MediaItem }
  | { name: 'libraryDetail'; itemId: string }
// ui:
export function SeasonSelector(props: { Action: ActionComponent; seasons: Array<{ id: string; name: string }>; selectedId: string; onSelect: (id: string) => void })
export function EpisodeList(props: { episodes: Episode[] })
```

- [ ] **Step 1: api-client + Navigation + Routing**

`api-client`: Methode wie oben (Typ-Import `LibraryDetailResponse`).

`navigation/store.ts`: Union um `{ name: 'libraryDetail'; itemId: string }` erweitern (Rest unverändert).

`experience.tsx`:
- `onOpenItem`-Callback des HomeScreens:
```tsx
onOpenItem={(item) =>
  useScreenStore.getState().push(
    item.jellyfin
      ? { name: 'libraryDetail', itemId: item.jellyfin.itemId }
      : { name: 'detail', item },
  )
}
```
- Neuer Zweig vor dem Home-Return:
```tsx
if (currentScreen.name === 'libraryDetail') {
  return (
    <LibraryDetailScreen
      Action={Action}
      apiBaseUrl={apiBaseUrl}
      storage={storage}
      itemId={currentScreen.itemId}
      userName={auth.user.name}
      onSignOut={handleSignOut}
      canConfigureGateway={canConfigureGateway}
      onConfigureGateway={onConfigureGateway}
      onBack={() => useScreenStore.getState().pop()}
    />
  )
}
```
- `storage`-Prop auch an `HomeScreen` durchreichen (Task 7).

- [ ] **Step 2: Hook + Screen**

`packages/features/src/library/useLibraryDetail.ts`:
```ts
import { useQuery } from '@tanstack/react-query'
import { useApi } from '../api.js'

export function useLibraryDetail({ apiBaseUrl, itemId }: { apiBaseUrl: string; itemId: string }) {
  const api = useApi()
  return useQuery({
    queryKey: ['library', apiBaseUrl, itemId],
    queryFn: () => api.libraryDetail(itemId),
  })
}
```

`packages/features/src/library/LibraryDetailScreen.tsx`:
```tsx
import { useMemo, useState } from 'react'
import { readJellyfinSession } from '@lolarr/jellyfin'
import {
  AppFrame,
  EpisodeList,
  ErrorPanel,
  LoadingPanel,
  SeasonSelector,
  type ActionComponent,
} from '@lolarr/ui'
import { readErrorMessage } from '../lib/errors.js'
import { resolveItemImages } from '../lib/images.js'
import type { KeyValueStorage } from '../storage.js'
import { useLibraryDetail } from './useLibraryDetail.js'

export function LibraryDetailScreen({
  Action,
  apiBaseUrl,
  storage,
  itemId,
  userName,
  onSignOut,
  canConfigureGateway,
  onConfigureGateway,
  onBack,
}: {
  Action: ActionComponent
  apiBaseUrl: string
  storage: KeyValueStorage
  itemId: string
  userName: string
  onSignOut: () => void
  canConfigureGateway: boolean
  onConfigureGateway: () => void
  onBack: () => void
}) {
  const detailQuery = useLibraryDetail({ apiBaseUrl, itemId })
  const jellyfinSession = useMemo(() => readJellyfinSession(storage), [storage])
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>()

  const frameProps = {
    Action,
    userName,
    onSignOut,
    onConfigureGateway: canConfigureGateway ? onConfigureGateway : undefined,
  }

  if (detailQuery.isLoading) {
    return (
      <AppFrame {...frameProps}>
        <LoadingPanel />
      </AppFrame>
    )
  }

  const data = detailQuery.data
  if (!data) {
    return (
      <AppFrame {...frameProps}>
        <ErrorPanel message={detailQuery.error ? readErrorMessage(detailQuery.error) : 'Item not found'} />
        <Action onPress={onBack} focusKey="library-back">Back</Action>
      </AppFrame>
    )
  }

  const { item, seasons } = data
  const images = resolveItemImages(item, jellyfinSession)
  const season = seasons?.find((s) => s.id === selectedSeasonId) ?? seasons?.[0]

  return (
    <AppFrame {...frameProps}>
      <section
        className="library-detail"
        style={images.backdropUrl ? { backgroundImage: `url(${images.backdropUrl})` } : undefined}
      >
        <div className="library-detail-content">
          <h1>{item.title}</h1>
          <p className="library-detail-meta">{item.year ?? ''}</p>
          <p>{item.overview}</p>
          <div className="library-detail-actions">
            <Action onPress={() => {}} disabled focusKey="library-play" ariaLabel="Play (coming soon)">
              ▶ Play (coming soon)
            </Action>
            <Action onPress={onBack} focusKey="library-back">Back</Action>
          </div>
        </div>
      </section>
      {seasons && seasons.length > 0 && season ? (
        <>
          <SeasonSelector
            Action={Action}
            seasons={seasons.map(({ id, name }) => ({ id, name }))}
            selectedId={season.id}
            onSelect={setSelectedSeasonId}
          />
          <EpisodeList episodes={season.episodes} />
        </>
      ) : null}
    </AppFrame>
  )
}
```

- [ ] **Step 3: UI-Komponenten**

`packages/ui/src/components/SeasonSelector.tsx`:
```tsx
import type { ActionComponent } from './types'

type SeasonSelectorProps = {
  Action: ActionComponent
  seasons: Array<{ id: string; name: string }>
  selectedId: string
  onSelect: (id: string) => void
}

export function SeasonSelector({ Action, seasons, selectedId, onSelect }: SeasonSelectorProps) {
  return (
    <nav className="season-selector" aria-label="Seasons">
      {seasons.map((season) => (
        <Action
          key={season.id}
          focusKey={`season-${season.id}`}
          className={season.id === selectedId ? 'season-button selected' : 'season-button'}
          onPress={() => onSelect(season.id)}
        >
          {season.name}
        </Action>
      ))}
    </nav>
  )
}
```

`packages/ui/src/components/EpisodeList.tsx`:
```tsx
import type { Episode } from '@lolarr/domain'

export function EpisodeList({ episodes }: { episodes: Episode[] }) {
  return (
    <ol className="episode-list">
      {episodes.map((episode) => (
        <li key={episode.id} className="episode-row">
          <span className="episode-number">{episode.episodeNumber}</span>
          <span className="episode-info">
            <span className="episode-title">
              {episode.title}
              {episode.played ? <span className="episode-played" aria-label="Watched"> ✓</span> : null}
            </span>
            {episode.overview ? <span className="episode-overview">{episode.overview}</span> : null}
          </span>
          {episode.runtimeMinutes ? (
            <span className="episode-runtime">{episode.runtimeMinutes} min</span>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
```
`packages/ui/src/index.ts`: beide re-exportieren. `styles.css` anhängen (an bestehende Panel-Ästhetik anlehnen):
```css
.library-detail {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background-size: cover;
  background-position: center;
}

.library-detail-content {
  padding: 3rem 2rem;
  background: linear-gradient(90deg, rgba(10, 10, 14, 0.92) 30%, rgba(10, 10, 14, 0.4));
  max-width: 60%;
}

.library-detail-meta { opacity: 0.7; }
.library-detail-actions { display: flex; gap: 0.75rem; margin-top: 1rem; }

.season-selector { display: flex; gap: 0.5rem; margin: 1.5rem 0 0.75rem; flex-wrap: wrap; }
.season-button.selected { outline: 2px solid #e50914; }

.episode-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.episode-row {
  display: flex;
  gap: 1rem;
  align-items: baseline;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
}
.episode-number { font-weight: 700; min-width: 2ch; opacity: 0.8; }
.episode-info { flex: 1; display: flex; flex-direction: column; gap: 0.25rem; }
.episode-overview { font-size: 0.85rem; opacity: 0.7; }
.episode-played { color: #46d369; }
.episode-runtime { font-size: 0.85rem; opacity: 0.6; white-space: nowrap; }
```
Hinweis: Falls `ActionProps` kein `className`/`disabled` unterstützt — prüfen (`packages/ui/src/components/types.tsx`); `disabled` existiert, `className` existiert. Passt.

- [ ] **Step 4: Verifizieren**

Run: `pnpm typecheck && pnpm lint && pnpm --filter @lolarr/web build && pnpm --filter @lolarr/tv build && pnpm --filter @lolarr/api test && pnpm --filter @lolarr/jellyfin test`
Expected: alles grün. Smoke: `pnpm dev:web` — Jellyfin-Kachel → LibraryDetail (Serie zeigt Staffeln/Episoden), Back funktioniert, Discover-Kachel → altes Detail.

- [ ] **Step 5: Commit**

```bash
git add packages/api-client packages/features packages/ui
git commit -m "feat: library detail screen with seasons, episodes and disabled play"
```

---

## Abschluss-Checkliste (nach Task 8)

- [ ] `pnpm --filter @lolarr/api test && pnpm --filter @lolarr/jellyfin test` — grün (Spec-Testfälle 1–7 + Units abgedeckt)
- [ ] `pnpm typecheck && pnpm lint && pnpm build` — grün
- [ ] Smoke Web: Login → Home mit Bibliotheks-Rows vor Discover, Hero = Weiterschauen, Fortschrittsbalken sichtbar, Jellyfin-Kachel → LibraryDetail mit Staffeln, Discover-Kachel → Seerr-Detail, Suche unverändert
- [ ] Degradations-Smoke: Jellyfin-URL absichtlich falsch konfigurieren → Home zeigt Discover-only (kein Fehler-Screen)
