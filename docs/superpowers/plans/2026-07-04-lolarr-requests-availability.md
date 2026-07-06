# Lolarr Slice 4: Requests & Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Suche + staffelgenaue Requests + Requests-Screen mit echtem Seerr-Status und Stornieren; Seerr wird Source of Truth (lokale requests-Tabelle entfällt).

**Architecture:** `GET/POST/DELETE /api/requests` proxien live gegen Seerr per User-Session (`fetchWithSession`); Status wird pro Abruf aus Seerr-Request+Media-Status gemappt. `seerr.media()` wechselt auf die kanonischen Detail-Endpunkte (`/api/v1/movie/{id}`, `/api/v1/tv/{id}`) und liefert bei TV per-Staffel-Availability für das `SeasonRequestPicker`-Overlay. Frontend: neue Screens `search` + `requests`, Home verliert die Inline-Suche und bekommt eine Header-Zeile.

**Tech Stack:** Fastify + undici MockAgent (Tests), Zod, react-query, zustand, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-04-lolarr-requests-availability-design.md` — bei Widerspruch gewinnt die Spec.

## Global Constraints

- Seerr ist Source of Truth: KEINE lokale Request-Persistenz (Tabelle wird gedroppt, `database.createRequest/listRequests` entfernt, nicht wieder einführen).
- Request-Calls (list/create/delete) laufen IMMER über `sessions.fetchWithSession` (User-Cookie), NIE über den API-Key. Titel-Enrichment via `media()` darf den API-Key nutzen (wie Discover/Search).
- Status-Mapping exakt (Seerr `request.status` / `media.status` → Domain): 1/*→`pending`; 3/*→`declined`; 4/*→`failed`; 2/5→`available`; 2/3 und 2/4→`processing`; 2/sonst→`approved`. `canCancel` = Status `pending` oder `approved`.
- Seerr-4xx (außer 401) werden mit Original-Status + Seerr-Message an den Client durchgereicht; 401 bleibt beim bestehenden Silent-QC-Retry/502-Verhalten (sonst würde der Client fälschlich ausloggen). 5xx/unreachable bleiben 502 `seerr_unreachable`.
- TV-POST ohne `seasons` → Payload `seasons: 'all'` (Bestandsverhalten); `seasons` bei `movie` → 400. Specials (`seasonNumber 0`) erscheinen nie in Staffel-Listen.
- Repo-Regeln: erasableSyntaxOnly (keine TS-Parameter-Properties), ESM `.js`-Imports in packages/apps, UI-Texte englisch, Conventional Commits englisch.
- Nach jedem Task: `pnpm test && pnpm typecheck` grün (Frontend-Tasks zusätzlich `pnpm lint` + `pnpm --filter @lolarr/web build && pnpm --filter @lolarr/tv build`).
- Bewusste Plan-Abweichungen ggü. Spec (nicht „korrigieren"): (a) Debounce der Suche via `useDeferredValue` (bestehendes Repo-Muster) statt fester 400 ms; (b) kein react-query-Hook-Test für die Cancel-Invalidierung (kein Testing-Library-Setup im Repo) — Abdeckung stattdessen über Routen-Integrationstests + Picker-Logiktests + Store-Tests; (c) Home hatte bereits eine Inline-Suchleiste — sie wird auf den neuen Such-Screen VERSCHOBEN (Home-Suche entfällt ersatzlos); (d) `MediaRequest.title` ist optional (Seerr liefert im Request-Listing keinen Titel garantiert); BFF-Titel-Enrichment ist best-effort mit In-Memory-Cache, UI-Fallback „Movie/Series · TMDB {id}".

---

### Task 1: Domain-Schemas + api-client

**Files:**
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/api-client/src/index.ts`
- Test: `apps/api/tests/domain-schemas.test.ts` (erweitern)

**Interfaces:**
- Produces: `requestStatusSchema` + `'declined'`; `mediaRequestSchema` mit `title` optional, `seasons?: number[]`, `canCancel: boolean`; `createRequestSchema` + `seasons?: [number, ...number[]]` (positive ints, nonempty); `seasonAvailabilitySchema = { seasonNumber, name?, availability }` + Export `SeasonAvailability`; `mediaDetailResponseSchema` + `seasons?: SeasonAvailability[]`; api-client `deleteRequest(requestId: string): Promise<RequestsResponse>`.

- [ ] **Step 1: Failing Test** — in `apps/api/tests/domain-schemas.test.ts` ergänzen (bestehende describe-Struktur beibehalten, notfalls neues `describe('slice 4 request schemas')` ans Ende):

```ts
import {
  createRequestSchema,
  mediaDetailResponseSchema,
  mediaRequestSchema,
  requestStatusSchema,
} from '@lolarr/domain'

describe('slice 4 request schemas', () => {
  it('accepts declined as request status', () => {
    expect(requestStatusSchema.parse('declined')).toBe('declined')
  })

  it('accepts a media request without title but with seasons and canCancel', () => {
    const parsed = mediaRequestSchema.parse({
      id: '10',
      mediaType: 'tv',
      tmdbId: 1399,
      status: 'pending',
      seasons: [1, 3],
      canCancel: true,
      requestedBy: { id: '1', name: 'Joel' },
      createdAt: '2026-07-04T10:00:00.000Z',
    })
    expect(parsed.title).toBeUndefined()
    expect(parsed.seasons).toEqual([1, 3])
  })

  it('rejects an empty seasons array on create', () => {
    expect(() =>
      createRequestSchema.parse({ mediaType: 'tv', tmdbId: 1399, title: 'GoT', seasons: [] }),
    ).toThrow()
  })

  it('accepts season availabilities on the media detail response', () => {
    const parsed = mediaDetailResponseSchema.parse({
      item: {
        id: 'tv-1399',
        mediaType: 'tv',
        title: 'Game of Thrones',
        overview: '',
        availability: 'partiallyAvailable',
      },
      seasons: [{ seasonNumber: 1, name: 'Season 1', availability: 'available' }],
    })
    expect(parsed.seasons?.[0]?.availability).toBe('available')
  })
})
```

- [ ] **Step 2: Rot** — `pnpm --filter @lolarr/api test tests/domain-schemas.test.ts` → FAIL (declined unbekannt, canCancel fehlt im Schema, seasons unbekannt).

- [ ] **Step 3: Implementieren** — `packages/domain/src/index.ts`:

`requestStatusSchema` ersetzen durch:
```ts
export const requestStatusSchema = z.enum([
  'pending',
  'approved',
  'declined',
  'processing',
  'available',
  'failed',
])
```

`mediaRequestSchema` ersetzen durch:
```ts
export const mediaRequestSchema = z.object({
  id: z.string(),
  mediaType: mediaTypeSchema,
  tmdbId: z.number().int(),
  title: z.string().optional(),
  status: requestStatusSchema,
  seasons: z.array(z.number().int()).optional(),
  canCancel: z.boolean(),
  requestedBy: userSchema,
  createdAt: z.string(),
})
```

`createRequestSchema` ersetzen durch:
```ts
export const createRequestSchema = z.object({
  mediaType: mediaTypeSchema,
  tmdbId: z.number().int(),
  title: z.string().min(1),
  seasons: z.array(z.number().int().positive()).nonempty().optional(),
})
```

Direkt vor `mediaDetailResponseSchema` einfügen und dieses erweitern:
```ts
export const seasonAvailabilitySchema = z.object({
  seasonNumber: z.number().int().positive(),
  name: z.string().optional(),
  availability: availabilitySchema,
})
export type SeasonAvailability = z.infer<typeof seasonAvailabilitySchema>

export const mediaDetailResponseSchema = z.object({
  item: mediaItemSchema,
  seasons: z.array(seasonAvailabilitySchema).optional(),
})
```

`packages/api-client/src/index.ts` — nach `requests()` einfügen:
```ts
    deleteRequest(requestId: string) {
      return request<RequestsResponse>(`/api/requests/${encodeURIComponent(requestId)}`, {
        method: 'DELETE',
      })
    },
```

- [ ] **Step 4: Grün** — `pnpm --filter @lolarr/api test tests/domain-schemas.test.ts` → PASS. Danach `pnpm typecheck` — **erwartet FAIL** in `apps/api` (database.ts/requests.ts bauen noch `MediaRequest` ohne `canCancel`). Das ist in Ordnung, solange die Fehler exakt die in Task 4 umzubauenden Stellen betreffen; falls andere Pakete brechen, fixen. Um den Task grün abzuschließen: in `apps/api/src/services/database.ts` in `mapRequestRow` temporär `canCancel: false,` ergänzen (Task 4 löscht die Funktion ohnehin).

- [ ] **Step 5: Gates + Commit**

```bash
pnpm test && pnpm typecheck
git add packages/domain packages/api-client apps/api
git commit -m "feat: request schemas for seerr-backed requests and season availability"
```

---

### Task 2: Seerr-Request- und Staffel-Mapping (pure Funktionen)

**Files:**
- Modify: `apps/api/src/adapters/seerr.ts` (nur neue exportierte Funktionen + Helpers, keine Klassen-Änderung)
- Test: `apps/api/tests/seerr-request-mapping.test.ts` (neu)

**Interfaces:**
- Consumes: `mapSeerrAvailability`, `readString`, `readNumber`, `isRecord` (existieren in seerr.ts).
- Produces: `mapSeerrRequestStatus(requestStatus: number | undefined, mediaStatus: number | undefined): RequestStatus`; `mapSeerrRequest(value: unknown): MediaRequest | undefined`; `mapSeasonAvailabilities(value: unknown): SeasonAvailability[]` — alle aus `seerr.ts` exportiert.

- [ ] **Step 1: Failing Test** — `apps/api/tests/seerr-request-mapping.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  mapSeasonAvailabilities,
  mapSeerrRequest,
  mapSeerrRequestStatus,
} from '../src/adapters/seerr.js'

describe('mapSeerrRequestStatus', () => {
  it.each([
    [1, 5, 'pending'],
    [3, 5, 'declined'],
    [4, 1, 'failed'],
    [2, 5, 'available'],
    [2, 3, 'processing'],
    [2, 4, 'processing'],
    [2, 1, 'approved'],
    [2, undefined, 'approved'],
    [undefined, undefined, 'pending'],
  ])('maps request status %s with media status %s to %s', (requestStatus, mediaStatus, expected) => {
    expect(mapSeerrRequestStatus(requestStatus, mediaStatus)).toBe(expected)
  })
})

describe('mapSeerrRequest', () => {
  const base = {
    id: 10,
    status: 1,
    createdAt: '2026-07-04T10:00:00.000Z',
    media: { mediaType: 'tv', tmdbId: 1399, status: 2, title: 'Game of Thrones' },
    requestedBy: { id: 1, displayName: 'Joel' },
    seasons: [{ seasonNumber: 1 }, { seasonNumber: 3 }],
  }

  it('maps a pending tv request with seasons and cancel flag', () => {
    expect(mapSeerrRequest(base)).toEqual({
      id: '10',
      mediaType: 'tv',
      tmdbId: 1399,
      title: 'Game of Thrones',
      status: 'pending',
      seasons: [1, 3],
      canCancel: true,
      requestedBy: { id: '1', name: 'Joel' },
      createdAt: '2026-07-04T10:00:00.000Z',
    })
  })

  it('marks available requests as not cancelable and omits empty seasons', () => {
    const mapped = mapSeerrRequest({
      ...base,
      status: 2,
      media: { mediaType: 'movie', tmdbId: 550, status: 5 },
      seasons: [],
    })
    expect(mapped?.status).toBe('available')
    expect(mapped?.canCancel).toBe(false)
    expect(mapped?.seasons).toBeUndefined()
    expect(mapped?.title).toBeUndefined()
  })

  it('returns undefined without a media tmdb id', () => {
    expect(mapSeerrRequest({ id: 1, status: 1, media: { mediaType: 'movie' } })).toBeUndefined()
  })
})

describe('mapSeasonAvailabilities', () => {
  it('joins season list with per-season status and skips specials', () => {
    const seasons = mapSeasonAvailabilities({
      seasons: [
        { seasonNumber: 0, name: 'Specials' },
        { seasonNumber: 1, name: 'Season 1' },
        { seasonNumber: 2, name: 'Season 2' },
        { seasonNumber: 3, name: 'Season 3' },
      ],
      mediaInfo: {
        seasons: [
          { seasonNumber: 1, status: 5 },
          { seasonNumber: 2, status: 2 },
        ],
      },
    })
    expect(seasons).toEqual([
      { seasonNumber: 1, name: 'Season 1', availability: 'available' },
      { seasonNumber: 2, name: 'Season 2', availability: 'requested' },
      { seasonNumber: 3, name: 'Season 3', availability: 'requestable' },
    ])
  })

  it('returns an empty list without seasons', () => {
    expect(mapSeasonAvailabilities({})).toEqual([])
    expect(mapSeasonAvailabilities(undefined)).toEqual([])
  })
})
```

- [ ] **Step 2: Rot** — `pnpm --filter @lolarr/api test tests/seerr-request-mapping.test.ts` → FAIL (Exporte fehlen).

- [ ] **Step 3: Implementieren** — in `apps/api/src/adapters/seerr.ts`:

Import-Zeile erweitern:
```ts
import type {
  MediaItem,
  MediaRequest,
  MediaRow,
  MediaType,
  RequestStatus,
  SeasonAvailability,
} from '@lolarr/domain'
```

Nach `mapSeerrAvailability` einfügen:
```ts
export function mapSeerrRequestStatus(
  requestStatus: number | undefined,
  mediaStatus: number | undefined,
): RequestStatus {
  if (requestStatus === 3) {
    return 'declined'
  }
  if (requestStatus === 4) {
    return 'failed'
  }
  if (requestStatus === 2) {
    if (mediaStatus === 5) {
      return 'available'
    }
    if (mediaStatus === 3 || mediaStatus === 4) {
      return 'processing'
    }
    return 'approved'
  }
  return 'pending'
}

export function mapSeerrRequest(value: unknown): MediaRequest | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const media = isRecord(value.media) ? value.media : undefined
  const requestId = readNumber(value, ['id'])
  const tmdbId = readNumber(media, ['tmdbId'])
  const mediaType = readString(media ?? {}, ['mediaType'])

  if (requestId === undefined || tmdbId === undefined || (mediaType !== 'movie' && mediaType !== 'tv')) {
    return undefined
  }

  const status = mapSeerrRequestStatus(readNumber(value, ['status']), readNumber(media, ['status']))
  const requestedBy = isRecord(value.requestedBy) ? value.requestedBy : undefined
  const requestedById = readNumber(requestedBy, ['id'])
  const seasons = Array.isArray(value.seasons)
    ? value.seasons
        .map((season) => (isRecord(season) ? readNumber(season, ['seasonNumber']) : undefined))
        .filter((seasonNumber): seasonNumber is number => typeof seasonNumber === 'number' && seasonNumber > 0)
    : []

  return {
    id: String(requestId),
    mediaType,
    tmdbId,
    title: readString(media, ['title', 'name']),
    status,
    seasons: seasons.length > 0 ? seasons : undefined,
    canCancel: status === 'pending' || status === 'approved',
    requestedBy: {
      id: requestedById !== undefined ? String(requestedById) : 'unknown',
      name: readString(requestedBy ?? {}, ['displayName', 'username', 'email']) ?? 'Unknown user',
    },
    createdAt: readString(value, ['createdAt']) ?? '',
  }
}

export function mapSeasonAvailabilities(value: unknown): SeasonAvailability[] {
  if (!isRecord(value) || !Array.isArray(value.seasons)) {
    return []
  }

  const mediaInfo = isRecord(value.mediaInfo) ? value.mediaInfo : undefined
  const statusBySeason = new Map<number, number>()
  if (mediaInfo && Array.isArray(mediaInfo.seasons)) {
    for (const season of mediaInfo.seasons) {
      if (!isRecord(season)) {
        continue
      }
      const seasonNumber = readNumber(season, ['seasonNumber'])
      const status = readNumber(season, ['status'])
      if (seasonNumber !== undefined && status !== undefined) {
        statusBySeason.set(seasonNumber, status)
      }
    }
  }

  return value.seasons
    .map((season) => {
      if (!isRecord(season)) {
        return undefined
      }
      const seasonNumber = readNumber(season, ['seasonNumber'])
      if (seasonNumber === undefined || seasonNumber <= 0) {
        return undefined
      }
      return {
        seasonNumber,
        name: readString(season, ['name']),
        availability: mapSeerrAvailability(statusBySeason.get(seasonNumber)),
      }
    })
    .filter((season): season is SeasonAvailability => season !== undefined)
}
```

- [ ] **Step 4: Grün** — `pnpm --filter @lolarr/api test tests/seerr-request-mapping.test.ts` → PASS, dann `pnpm test && pnpm typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: map seerr requests and season availability to domain"
```

---

### Task 3: fetchWithSession-Erweiterung + Seerr-4xx-Durchreichung

**Files:**
- Modify: `apps/api/src/services/seerrSession.ts` (`fetchWithSession`)
- Modify: `apps/api/src/plugins/errors.ts` (UpstreamError-Zweig)
- Test: `apps/api/tests/seerr-session.test.ts` (erweitern), `apps/api/tests/errors.test.ts` (erweitern)

**Interfaces:**
- Produces: `fetchWithSession` liefert bei 204 `undefined` statt `json()`-Crash; wirft bei !ok `UpstreamError('seerr', status, <Seerr-message ?? generisch>)`. Error-Handler: Seerr-UpstreamError mit Status 400–499 (außer 401) → HTTP <status> + `{ error: <message> }`; alles andere unverändert 502.

- [ ] **Step 1: Failing Tests**

In `apps/api/tests/seerr-session.test.ts` ans Ende des bestehenden describe (Konstruktion von Service/Context den bestehenden Tests der Datei nachbauen — die Datei enthält bereits Instanziierungs-Muster; neue Tests folgen exakt diesem Muster):

```ts
it('returns undefined for 204 responses', async () => {
  // Muster der Datei: cookie vorbelegen (database.saveSeerrCookie oder Login-Intercept),
  // dann Intercept auf den Ziel-Pfad:
  ctx.seerr
    .intercept({ path: '/api/v1/request/10', method: 'DELETE' })
    .reply(204)

  const result = await service.fetchWithSession('jf-user-1', '/api/v1/request/10', { method: 'DELETE' })
  expect(result).toBeUndefined()
})

it('throws an upstream error carrying the seerr message on 4xx', async () => {
  ctx.seerr
    .intercept({ path: '/api/v1/request', method: 'POST' })
    .reply(403, { message: 'Quota exceeded' }, { headers: { 'content-type': 'application/json' } })

  await expect(
    service.fetchWithSession('jf-user-1', '/api/v1/request', { method: 'POST', body: {} }),
  ).rejects.toMatchObject({ name: 'UpstreamError', status: 403, message: 'Quota exceeded' })
})
```

In `apps/api/tests/errors.test.ts` (bestehende Handler-Tests erweitern; Muster der Datei folgen — sie testet den Error-Handler über eine Route, die den Fehler wirft):

```ts
it('passes seerr 4xx errors through with the seerr message', async () => {
  // Route wirft: new UpstreamError('seerr', 403, 'Quota exceeded')
  // Erwartung: HTTP 403, body { error: 'Quota exceeded' }
})

it('keeps seerr 401 as 502 so the client session is not killed', async () => {
  // Route wirft: new UpstreamError('seerr', 401, 'whatever')
  // Erwartung: HTTP 502, body { error: 'seerr_unreachable' }
})
```
(Die zwei Tests konkret ausformulieren nach dem in errors.test.ts etablierten Muster — dieselbe Fake-Route-Technik, nur andere Fehlerwerte.)

- [ ] **Step 2: Rot** — `pnpm --filter @lolarr/api test tests/seerr-session.test.ts tests/errors.test.ts` → FAIL.

- [ ] **Step 3: Implementieren**

`apps/api/src/services/seerrSession.ts` — `fetchWithSession` ersetzen:
```ts
  async fetchWithSession(
    userId: string,
    path: string,
    init: { method?: string; body?: unknown } = {},
  ): Promise<unknown> {
    let cookie = await this.ensureSession(userId)
    let response = await this.seerrFetch(path, { ...init, cookie })

    if (response.status === 401) {
      this.cookies.delete(userId)
      this.database.clearSeerrCookie(userId)
      cookie = await this.silentQuickConnect(userId)
      response = await this.seerrFetch(path, { ...init, cookie })
    }

    if (!response.ok) {
      throw new UpstreamError('seerr', response.status, await readSeerrErrorMessage(response, path))
    }

    if (response.status === 204) {
      return undefined
    }

    return response.json()
  }
```

Am Datei-Ende (bei den anderen Helpern) ergänzen:
```ts
async function readSeerrErrorMessage(response: Response, path: string) {
  try {
    const payload = (await response.json()) as { message?: string; error?: string }
    return payload.message ?? payload.error ?? `Seerr request failed: ${path}`
  } catch {
    return `Seerr request failed: ${path}`
  }
}
```
(Falls `assertOk` danach in `fetchWithSession` nicht mehr genutzt wird: Import/Nutzung an den übrigen Stellen — Silent-QC — bleibt.)

`apps/api/src/plugins/errors.ts` — UpstreamError-Zweig ersetzen:
```ts
    if (error instanceof UpstreamError) {
      request.log.error({ err: error }, 'upstream request failed')
      // Seerr client errors (quota, permission, not found) carry a user-facing
      // message. 401 stays a 502: it only occurs after the silent-QC retry
      // failed, and returning 401 here would wrongly end the Lolarr session.
      if (
        error.service === 'seerr' &&
        error.status !== undefined &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 401
      ) {
        return reply.code(error.status).send({ error: error.message })
      }
      return reply.code(502).send({ error: `${error.service}_unreachable` })
    }
```

- [ ] **Step 4: Grün** — `pnpm --filter @lolarr/api test tests/seerr-session.test.ts tests/errors.test.ts`, dann `pnpm test && pnpm typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: pass seerr client errors through and support empty responses"
```

---

### Task 4: Adapter-Methoden + Routen + DB-Migration (Seerr als Source of Truth)

**Files:**
- Modify: `apps/api/src/adapters/seerr.ts` (Klasse: `listRequests`, `requestMedia`-Umbau, `deleteRequest`, `media`-Umbau, Titel-Cache)
- Modify: `apps/api/src/modules/requests.ts`, `apps/api/src/modules/media.ts`
- Modify: `apps/api/src/services/database.ts` (requests-Teile entfernen, Drop-Migration)
- Test: `apps/api/tests/requests.test.ts` (neu), `apps/api/tests/requests-seerr-session.test.ts` (anpassen), `apps/api/tests/requests-visibility.test.ts` (löschen), `apps/api/tests/database.test.ts` (anpassen)

**Interfaces:**
- Consumes: Task-2-Mapper, Task-3-`fetchWithSession`.
- Produces: `SeerrAdapter.listRequests(userId): Promise<MediaRequest[]>`; `SeerrAdapter.requestMedia(userId, payload: CreateRequest): Promise<MediaRequest | undefined>`; `SeerrAdapter.deleteRequest(userId, requestId: string): Promise<void>`; `SeerrAdapter.media(mediaType, tmdbId): Promise<{ item: MediaItem; seasons?: SeasonAvailability[] } | undefined>`; Routen `GET/POST/DELETE /api/requests` (alle antworten `{ requests }`), `GET /api/media/...` antwortet `{ item, seasons? }`.

- [ ] **Step 1: Failing Tests** — `apps/api/tests/requests.test.ts` (neu):

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createServer } from '../src/server.js'
import { createTestContext, jellyfinAuthResponse } from './helpers.js'

function seerrRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    status: 1,
    createdAt: '2026-07-04T10:00:00.000Z',
    media: { mediaType: 'movie', tmdbId: 550, status: 1, title: 'Fight Club' },
    requestedBy: { id: 1, displayName: 'Joel' },
    seasons: [],
    ...overrides,
  }
}

async function loginWithSeerrSession(app: FastifyInstance, ctx: ReturnType<typeof createTestContext>) {
  ctx.jellyfin
    .intercept({ path: '/Users/AuthenticateByName', method: 'POST' })
    .reply(200, jellyfinAuthResponse(), { headers: { 'content-type': 'application/json' } })
  ctx.seerr
    .intercept({ path: '/api/v1/auth/jellyfin', method: 'POST' })
    .reply(200, { id: 1 }, { headers: { 'set-cookie': 'connect.sid=s%3Auser; Path=/' } })

  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'joel', password: 'pw', deviceId: 'device-abc' },
  })
  return (login.json() as { token: string }).token
}

function interceptRequestList(ctx: ReturnType<typeof createTestContext>, results: unknown[]) {
  ctx.seerr
    .intercept({ path: '/api/v1/request', method: 'GET', query: { take: '50', sort: 'added' } })
    .reply(200, { pageInfo: {}, results }, { headers: { 'content-type': 'application/json' } })
}

describe('requests routes (seerr as source of truth)', () => {
  let ctx: ReturnType<typeof createTestContext>
  let app: FastifyInstance
  let token: string

  beforeEach(async () => {
    ctx = createTestContext()
    app = createServer(ctx.config)
    token = await loginWithSeerrSession(app, ctx)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('maps the full status table on GET /api/requests', async () => {
    interceptRequestList(ctx, [
      seerrRequest({ id: 1, status: 1, media: { mediaType: 'movie', tmdbId: 1, status: 5, title: 'A' } }),
      seerrRequest({ id: 2, status: 3, media: { mediaType: 'movie', tmdbId: 2, status: 1, title: 'B' } }),
      seerrRequest({ id: 3, status: 4, media: { mediaType: 'movie', tmdbId: 3, status: 1, title: 'C' } }),
      seerrRequest({ id: 4, status: 2, media: { mediaType: 'movie', tmdbId: 4, status: 5, title: 'D' } }),
      seerrRequest({ id: 5, status: 2, media: { mediaType: 'movie', tmdbId: 5, status: 3, title: 'E' } }),
      seerrRequest({ id: 6, status: 2, media: { mediaType: 'movie', tmdbId: 6, status: 1, title: 'F' } }),
    ])

    const response = await app.inject({
      method: 'GET',
      url: '/api/requests',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.statusCode).toBe(200)
    const { requests } = response.json()
    expect(requests.map((r: { status: string }) => r.status)).toEqual([
      'pending', 'declined', 'failed', 'available', 'processing', 'approved',
    ])
    expect(requests.map((r: { canCancel: boolean }) => r.canCancel)).toEqual([
      true, false, false, false, false, true,
    ])
  })

  it('enriches missing titles via media details and caches them', async () => {
    interceptRequestList(ctx, [
      seerrRequest({ media: { mediaType: 'movie', tmdbId: 550, status: 1 } }),
    ])
    ctx.seerr
      .intercept({ path: '/api/v1/movie/550', method: 'GET' })
      .reply(200, { id: 550, title: 'Fight Club', overview: '' }, { headers: { 'content-type': 'application/json' } })

    const response = await app.inject({
      method: 'GET',
      url: '/api/requests',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.json().requests[0].title).toBe('Fight Club')

    // Zweiter Abruf: kein neuer /api/v1/movie/550-Intercept nötig (Cache).
    interceptRequestList(ctx, [
      seerrRequest({ media: { mediaType: 'movie', tmdbId: 550, status: 1 } }),
    ])
    const second = await app.inject({
      method: 'GET',
      url: '/api/requests',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(second.json().requests[0].title).toBe('Fight Club')
  })

  it('sends selected seasons on POST and returns the fresh list', async () => {
    let seenBody: Record<string, unknown> | undefined
    ctx.seerr
      .intercept({
        path: '/api/v1/request',
        method: 'POST',
        body: (raw) => {
          seenBody = JSON.parse(raw as string) as Record<string, unknown>
          return true
        },
      })
      .reply(201, seerrRequest({ id: 20, status: 2, media: { mediaType: 'tv', tmdbId: 1399, status: 2 }, seasons: [{ seasonNumber: 1 }, { seasonNumber: 3 }] }), { headers: { 'content-type': 'application/json' } })
    interceptRequestList(ctx, [
      seerrRequest({ id: 20, status: 2, media: { mediaType: 'tv', tmdbId: 1399, status: 2, name: 'Game of Thrones' }, seasons: [{ seasonNumber: 1 }, { seasonNumber: 3 }] }),
    ])

    const response = await app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: { mediaType: 'tv', tmdbId: 1399, title: 'Game of Thrones', seasons: [1, 3] },
    })

    expect(response.statusCode).toBe(200)
    expect(seenBody).toEqual({ mediaType: 'tv', mediaId: 1399, seasons: [1, 3] })
    expect(response.json().requests[0].seasons).toEqual([1, 3])
    expect(response.json().requests[0].status).toBe('approved')
  })

  it('rejects seasons on a movie request', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: { mediaType: 'movie', tmdbId: 550, title: 'Fight Club', seasons: [1] },
    })
    expect(response.statusCode).toBe(400)
  })

  it('passes a seerr quota error through on POST', async () => {
    ctx.seerr
      .intercept({ path: '/api/v1/request', method: 'POST' })
      .reply(403, { message: 'Quota exceeded' }, { headers: { 'content-type': 'application/json' } })

    const response = await app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: { mediaType: 'movie', tmdbId: 550, title: 'Fight Club' },
    })
    expect(response.statusCode).toBe(403)
    expect(response.json().error).toBe('Quota exceeded')
  })

  it('cancels a request on DELETE and returns the fresh list', async () => {
    ctx.seerr.intercept({ path: '/api/v1/request/10', method: 'DELETE' }).reply(204)
    interceptRequestList(ctx, [])

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/requests/10',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().requests).toEqual([])
  })

  it('passes a seerr permission error through on DELETE', async () => {
    ctx.seerr
      .intercept({ path: '/api/v1/request/10', method: 'DELETE' })
      .reply(403, { message: 'You do not have permission to delete this request.' }, { headers: { 'content-type': 'application/json' } })

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/requests/10',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(response.statusCode).toBe(403)
  })

  it('returns tv media detail with season availabilities', async () => {
    ctx.seerr
      .intercept({ path: '/api/v1/tv/1399', method: 'GET' })
      .reply(200, {
        id: 1399,
        name: 'Game of Thrones',
        firstAirDate: '2011-04-17',
        overview: 'Winter is coming.',
        mediaInfo: { status: 4, seasons: [{ seasonNumber: 1, status: 5 }, { seasonNumber: 2, status: 2 }] },
        seasons: [
          { seasonNumber: 0, name: 'Specials' },
          { seasonNumber: 1, name: 'Season 1' },
          { seasonNumber: 2, name: 'Season 2' },
          { seasonNumber: 3, name: 'Season 3' },
        ],
      }, { headers: { 'content-type': 'application/json' } })

    const response = await app.inject({
      method: 'GET',
      url: '/api/media/tv/1399',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.item.availability).toBe('partiallyAvailable')
    expect(body.seasons).toEqual([
      { seasonNumber: 1, name: 'Season 1', availability: 'available' },
      { seasonNumber: 2, name: 'Season 2', availability: 'requested' },
      { seasonNumber: 3, name: 'Season 3', availability: 'requestable' },
    ])
  })

  it('returns movie media detail from the canonical endpoint without seasons', async () => {
    ctx.seerr
      .intercept({ path: '/api/v1/movie/550', method: 'GET' })
      .reply(200, { id: 550, title: 'Fight Club', releaseDate: '1999-10-15', overview: '...' }, { headers: { 'content-type': 'application/json' } })

    const response = await app.inject({
      method: 'GET',
      url: '/api/media/movie/550',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().item.title).toBe('Fight Club')
    expect(response.json().seasons).toBeUndefined()
  })
})
```

`apps/api/tests/database.test.ts`: alle Tests zu `createRequest`/`listRequests` entfernen; neuen Test ergänzen:

```ts
it('drops the legacy requests table on migration', () => {
  const path = join(tmpdir(), `lolarr-migrate-${randomUUID()}.sqlite`)
  const legacy = new DatabaseSync(path)
  legacy.exec(`create table requests (id text primary key)`)
  legacy.close()

  new LolarrDatabase(path, 'test-secret-at-least-16-chars')

  const check = new DatabaseSync(path)
  const table = check
    .prepare(`select name from sqlite_master where type = 'table' and name = 'requests'`)
    .get()
  check.close()
  rmSync(path, { force: true })
  expect(table).toBeUndefined()
})
```
(Imports `DatabaseSync` aus `node:sqlite`, `tmpdir`, `join`, `randomUUID`, `rmSync` nach Muster der Datei ergänzen.)

`apps/api/tests/requests-visibility.test.ts`: **löschen** (Sichtbarkeit erzwingt jetzt Seerr; Cookie-Nutzung deckt requests-seerr-session ab).

`apps/api/tests/requests-seerr-session.test.ts`: im ersten Test zusätzlich den List-Refetch nach POST intercepten (sonst schlägt die Route beim Listen fehl):
```ts
ctx.seerr
  .intercept({ path: '/api/v1/request', method: 'GET', query: { take: '50', sort: 'added' } })
  .reply(200, { results: [] }, { headers: { 'content-type': 'application/json' } })
```
und `.reply(201, { id: 42 }, ...)` ersetzen durch `.reply(201, { id: 42, status: 1, media: { mediaType: 'movie', tmdbId: 550, status: 2 } }, ...)`. Der zweite Test (401-Kaskade) bleibt unverändert.

- [ ] **Step 2: Rot** — `pnpm --filter @lolarr/api test tests/requests.test.ts tests/database.test.ts` → FAIL.

- [ ] **Step 3: Implementieren**

`apps/api/src/adapters/seerr.ts` — Klassen-Änderungen:

Import ergänzen: `import type { CreateRequest } from '@lolarr/domain'` (in die bestehende Type-Import-Liste).

Feld ergänzen (nach `discoverCache`):
```ts
  private readonly titleCache = new Map<string, string>()
```

`media()` ersetzen:
```ts
  async media(
    mediaType: MediaType,
    tmdbId: number,
  ): Promise<{ item: MediaItem; seasons?: SeasonAvailability[] } | undefined> {
    const path = mediaType === 'movie' ? `/api/v1/movie/${tmdbId}` : `/api/v1/tv/${tmdbId}`
    const response = await this.request(path)
    const item = mapSeerrItem(response, mediaType)

    if (!item) {
      return undefined
    }

    if (mediaType === 'movie') {
      return { item }
    }

    return { item, seasons: mapSeasonAvailabilities(response) }
  }
```

`requestMedia()` ersetzen:
```ts
  async requestMedia(userId: string, payload: CreateRequest): Promise<MediaRequest | undefined> {
    const body =
      payload.mediaType === 'movie'
        ? { mediaType: 'movie', mediaId: payload.tmdbId }
        : { mediaType: 'tv', mediaId: payload.tmdbId, seasons: payload.seasons ?? 'all' }

    const response = await this.sessions.fetchWithSession(userId, '/api/v1/request', {
      method: 'POST',
      body,
    })

    this.discoverCache = undefined
    const request = mapSeerrRequest(response)
    if (request && !request.title) {
      request.title = payload.title
    }
    return request
  }
```

Neue Methoden (nach `requestMedia`):
```ts
  async listRequests(userId: string): Promise<MediaRequest[]> {
    const response = await this.sessions.fetchWithSession(userId, '/api/v1/request?take=50&sort=added')
    const results = isRecord(response) && Array.isArray(response.results) ? response.results : []
    const requests = results
      .map((entry) => mapSeerrRequest(entry))
      .filter((request): request is MediaRequest => request !== undefined)
    await this.fillMissingTitles(requests)
    return requests
  }

  async deleteRequest(userId: string, requestId: string): Promise<void> {
    await this.sessions.fetchWithSession(userId, `/api/v1/request/${encodeURIComponent(requestId)}`, {
      method: 'DELETE',
    })
  }

  // Seerr's request listing carries no display title; details are fetched once
  // per (mediaType, tmdbId) and cached for the process lifetime (titles are
  // effectively immutable). Failures degrade to the UI's TMDB-id fallback.
  private async fillMissingTitles(requests: MediaRequest[]) {
    const missing = new Map<string, { mediaType: MediaType; tmdbId: number }>()
    for (const request of requests) {
      const key = `${request.mediaType}-${request.tmdbId}`
      if (!request.title && !this.titleCache.has(key)) {
        missing.set(key, { mediaType: request.mediaType, tmdbId: request.tmdbId })
      }
    }

    await Promise.all(
      [...missing.entries()].map(async ([key, target]) => {
        try {
          const detail = await this.media(target.mediaType, target.tmdbId)
          if (detail) {
            this.titleCache.set(key, detail.item.title)
          }
        } catch {
          // best effort — see comment above
        }
      }),
    )

    for (const request of requests) {
      request.title ??= this.titleCache.get(`${request.mediaType}-${request.tmdbId}`)
    }
  }
```

`apps/api/src/modules/requests.ts` komplett ersetzen:
```ts
import type { FastifyInstance } from 'fastify'
import { createRequestSchema } from '@lolarr/domain'
import type { AppContext } from '../lib/context.js'

export async function requestsRoutes(app: FastifyInstance, { seerr }: AppContext) {
  app.get('/api/requests', async (request) => {
    return { requests: await seerr.listRequests(request.session.user.id) }
  })

  app.post('/api/requests', async (request, reply) => {
    const payload = createRequestSchema.parse(request.body)

    if (payload.mediaType === 'movie' && payload.seasons) {
      return reply.code(400).send({ error: 'Seasons can only be requested for series' })
    }

    await seerr.requestMedia(request.session.user.id, payload)
    return { requests: await seerr.listRequests(request.session.user.id) }
  })

  app.delete('/api/requests/:id', async (request) => {
    const { id } = request.params as { id: string }
    await seerr.deleteRequest(request.session.user.id, id)
    return { requests: await seerr.listRequests(request.session.user.id) }
  })
}
```

`apps/api/src/modules/media.ts` — Route-Ende ersetzen:
```ts
    const detail = await seerr.media(mediaType, tmdbId)

    if (!detail) {
      return reply.code(404).send({ error: 'Media item not found' })
    }

    return { item: detail.item, seasons: detail.seasons }
```

`apps/api/src/services/database.ts`:
- `RequestInput`, `listRequests`, `createRequest`, `StoredRequestRow`, `mapRequestRow`, `migrateRequestsUniqueConstraintToPerUser` (inkl. Aufruf) und den `create table if not exists requests (…)`-Block **entfernen**; nicht mehr benötigte Imports (`MediaRequest`, `MediaType`, `RequestStatus`) mit entfernen.
- In `migrate()` nach dem `seerr_cookie`-Check ergänzen:
```ts
    // Slice 4: requests live in Seerr (source of truth); the local table from
    // slice 1 is dropped. 'if exists' keeps this idempotent for fresh databases.
    this.database.exec('drop table if exists requests')
```

- [ ] **Step 4: Grün** — `pnpm --filter @lolarr/api test` → PASS (alle API-Tests), dann `pnpm test && pnpm typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: proxy requests live from seerr and drop the local requests table"
```

---

### Task 5: ui-Komponenten (Badges, RequestList, DetailPanel, Poster, SeasonRequestPicker) + ui-Vitest

**Files:**
- Create: `packages/ui/src/components/requestStatusLabels.ts`, `packages/ui/src/components/RequestStatusBadge.tsx`, `packages/ui/src/components/seasonSelection.ts`, `packages/ui/src/components/SeasonRequestPicker.tsx`, `packages/ui/vitest.config.ts`, `packages/ui/tests/seasonSelection.test.ts`
- Modify: `packages/ui/src/components/RequestList.tsx`, `packages/ui/src/components/DetailPanel.tsx`, `packages/ui/src/components/MediaPosterButton.tsx`, `packages/ui/src/index.ts`, `packages/ui/src/styles.css`, `packages/ui/package.json`, `packages/ui/moon.yml`
- Test: `packages/ui/tests/seasonSelection.test.ts`

**Interfaces:**
- Consumes: `RequestStatus`, `MediaRequest`, `SeasonAvailability` aus `@lolarr/domain`; `ActionComponent` aus `./types`.
- Produces: `RequestStatusBadge({ status })`; `RequestList({ requests, Action, limit?, onViewAll?, onCancel?, cancelingId?, cancelError? })`; `SeasonRequestPicker({ seasons, isRequesting, errorMessage?, onConfirm, onClose, Action })`; `selectableSeasonNumbers(seasons): number[]`; `toggleSeason(selection, seasonNumber): number[]`; `DetailPanel` + Prop `requestError?: string` und TV-partiallyAvailable-Request-Logik. Alles über `packages/ui/src/index.ts` exportiert.

- [ ] **Step 1: ui-Vitest verdrahten** — `packages/ui/package.json`: devDependency `"vitest": "^3"` + Script `"test": "vitest run"` ergänzen; `packages/ui/vitest.config.ts` und den `test`-Task in `packages/ui/moon.yml` **exakt nach dem Muster von `packages/player`** anlegen (Dateien dort nachschlagen und spiegeln). Danach `pnpm install`.

- [ ] **Step 2: Failing Test** — `packages/ui/tests/seasonSelection.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { selectableSeasonNumbers, toggleSeason } from '../src/components/seasonSelection.js'

describe('selectableSeasonNumbers', () => {
  it('keeps only requestable and unavailable seasons', () => {
    expect(
      selectableSeasonNumbers([
        { seasonNumber: 1, availability: 'available' },
        { seasonNumber: 2, availability: 'requested' },
        { seasonNumber: 3, availability: 'requestable' },
        { seasonNumber: 4, availability: 'unavailable' },
        { seasonNumber: 5, availability: 'processing' },
      ]),
    ).toEqual([3, 4])
  })
})

describe('toggleSeason', () => {
  it('adds a missing season keeping the list sorted', () => {
    expect(toggleSeason([3], 1)).toEqual([1, 3])
  })

  it('removes an already selected season', () => {
    expect(toggleSeason([1, 3], 3)).toEqual([1])
  })
})
```

- [ ] **Step 3: Rot** — `pnpm --filter @lolarr/ui test` → FAIL (Modul fehlt).

- [ ] **Step 4: Implementieren**

`packages/ui/src/components/seasonSelection.ts`:
```ts
import type { SeasonAvailability } from '@lolarr/domain'

export function selectableSeasonNumbers(seasons: SeasonAvailability[]): number[] {
  return seasons
    .filter((season) => season.availability === 'requestable' || season.availability === 'unavailable')
    .map((season) => season.seasonNumber)
}

export function toggleSeason(selection: number[], seasonNumber: number): number[] {
  return selection.includes(seasonNumber)
    ? selection.filter((selected) => selected !== seasonNumber)
    : [...selection, seasonNumber].sort((a, b) => a - b)
}
```

`packages/ui/src/components/requestStatusLabels.ts`:
```ts
import type { RequestStatus } from '@lolarr/domain'

export function labelForRequestStatus(status: RequestStatus) {
  switch (status) {
    case 'pending':
      return 'Pending approval'
    case 'approved':
      return 'Approved'
    case 'declined':
      return 'Declined'
    case 'processing':
      return 'Processing'
    case 'available':
      return 'Available'
    case 'failed':
      return 'Failed'
  }
}
```

`packages/ui/src/components/RequestStatusBadge.tsx`:
```tsx
import type { RequestStatus } from '@lolarr/domain'
import { labelForRequestStatus } from './requestStatusLabels'

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={`status-badge request-status-${status}`}>
      {labelForRequestStatus(status)}
    </span>
  )
}
```

`packages/ui/src/components/RequestList.tsx` komplett ersetzen:
```tsx
import type { MediaRequest } from '@lolarr/domain'
import type { ActionComponent } from './types'
import { RequestStatusBadge } from './RequestStatusBadge'

type RequestListProps = {
  requests: MediaRequest[]
  Action: ActionComponent
  limit?: number
  onViewAll?: () => void
  onCancel?: (request: MediaRequest) => void
  cancelingId?: string
  cancelError?: { id: string; message: string }
}

export function RequestList({
  requests,
  Action,
  limit,
  onViewAll,
  onCancel,
  cancelingId,
  cancelError,
}: RequestListProps) {
  const visible = limit !== undefined ? requests.slice(0, limit) : requests

  return (
    <section className="request-list">
      <div className="rail-heading">
        <h2>Recent requests</h2>
        {onViewAll ? (
          <Action className="ghost-action" onPress={onViewAll} focusKey="requests-view-all">
            View all
          </Action>
        ) : (
          <span>{requests.length} tracked</span>
        )}
      </div>
      {visible.length === 0 ? (
        <p className="empty-state">No requests yet.</p>
      ) : (
        <ul>
          {visible.map((request) => (
            <li key={request.id}>
              <span className="request-title">{requestTitle(request)}</span>
              <span className="request-meta">
                <RequestStatusBadge status={request.status} />
                {request.seasons?.length ? <small>Seasons {request.seasons.join(', ')}</small> : null}
                {request.createdAt ? <small>{request.createdAt.slice(0, 10)}</small> : null}
              </span>
              {onCancel && request.canCancel ? (
                <Action
                  className="ghost-action"
                  onPress={() => onCancel(request)}
                  focusKey={`request-cancel-${request.id}`}
                  disabled={cancelingId === request.id}
                >
                  {cancelingId === request.id ? 'Canceling...' : 'Cancel'}
                </Action>
              ) : null}
              {cancelError?.id === request.id ? (
                <small className="request-error">{cancelError.message}</small>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function requestTitle(request: MediaRequest) {
  return request.title ?? `${request.mediaType === 'movie' ? 'Movie' : 'Series'} · TMDB ${request.tmdbId}`
}
```

`packages/ui/src/components/SeasonRequestPicker.tsx`:
```tsx
import { useMemo, useState } from 'react'
import type { SeasonAvailability } from '@lolarr/domain'
import type { ActionComponent } from './types'
import { labelForAvailability } from './availabilityLabels'
import { selectableSeasonNumbers, toggleSeason } from './seasonSelection'

type SeasonRequestPickerProps = {
  seasons: SeasonAvailability[]
  isRequesting: boolean
  errorMessage?: string
  onConfirm: (seasons: number[]) => void
  onClose: () => void
  Action: ActionComponent
}

export function SeasonRequestPicker({
  seasons,
  isRequesting,
  errorMessage,
  onConfirm,
  onClose,
  Action,
}: SeasonRequestPickerProps) {
  const selectable = useMemo(() => selectableSeasonNumbers(seasons), [seasons])
  const [selection, setSelection] = useState<number[]>([])
  const allSelected = selectable.length > 0 && selection.length === selectable.length

  return (
    <div className="season-picker-backdrop">
      <section className="season-picker" aria-label="Request seasons">
        <h3>Request seasons</h3>
        <ul>
          <li>
            <Action
              className="ghost-action"
              onPress={() => setSelection(allSelected ? [] : selectable)}
              focusKey="season-pick-all"
              disabled={selectable.length === 0}
            >
              {allSelected ? 'Clear selection' : 'All seasons'}
            </Action>
          </li>
          {seasons.map((season) => {
            const isSelectable = selectable.includes(season.seasonNumber)
            const isSelected = selection.includes(season.seasonNumber)
            return (
              <li key={season.seasonNumber}>
                <Action
                  className={isSelected ? 'season-option selected' : 'season-option'}
                  onPress={() => setSelection((current) => toggleSeason(current, season.seasonNumber))}
                  focusKey={`season-pick-${season.seasonNumber}`}
                  disabled={!isSelectable}
                >
                  <span>{season.name ?? `Season ${season.seasonNumber}`}</span>
                  <small>{isSelectable ? (isSelected ? 'Selected' : '') : labelForAvailability(season.availability)}</small>
                </Action>
              </li>
            )
          })}
        </ul>
        {errorMessage ? <p className="request-error">{errorMessage}</p> : null}
        <div className="season-picker-actions">
          <Action
            className="primary-action"
            onPress={() => onConfirm(selection)}
            focusKey="season-pick-confirm"
            disabled={selection.length === 0 || isRequesting}
          >
            {isRequesting
              ? 'Requesting...'
              : `Request ${selection.length} ${selection.length === 1 ? 'season' : 'seasons'}`}
          </Action>
          <Action className="ghost-action" onPress={onClose} focusKey="season-pick-cancel" disabled={isRequesting}>
            Cancel
          </Action>
        </div>
      </section>
    </div>
  )
}
```

`packages/ui/src/components/DetailPanel.tsx` — Props + Logik anpassen (komplett ersetzen):
```tsx
import type { Availability, MediaItem, MediaType } from '@lolarr/domain'
import type { ActionComponent } from './types'
import { StatusBadge } from './StatusBadge'

type DetailPanelProps = {
  item: MediaItem
  isRequesting?: boolean
  requestError?: string
  onBack: () => void
  onRequest: (item: MediaItem) => void
  Action: ActionComponent
}

export function DetailPanel({
  item,
  isRequesting,
  requestError,
  onBack,
  onRequest,
  Action,
}: DetailPanelProps) {
  const canRequest =
    item.availability === 'requestable' ||
    item.availability === 'unavailable' ||
    (item.mediaType === 'tv' && item.availability === 'partiallyAvailable')

  return (
    <section className="detail-panel">
      <div className="detail-backdrop">
        {item.backdropUrl ? <img src={item.backdropUrl} alt="" /> : null}
      </div>
      <div className="detail-content">
        <Action className="ghost-action" onPress={onBack} focusKey="detail-back">
          Back
        </Action>
        <div className="detail-grid">
          <div className="detail-poster">
            {item.posterUrl ? <img src={item.posterUrl} alt="" /> : null}
          </div>
          <div>
            <StatusBadge availability={item.availability} />
            <h2>{item.title}</h2>
            <p>{item.overview}</p>
            <div className="hero-meta">
              {item.year ? <span>{item.year}</span> : null}
              <span>{item.mediaType === 'movie' ? 'Movie' : 'Series'}</span>
              {item.tmdbId !== undefined ? <span>TMDB {item.tmdbId}</span> : null}
            </div>
            <Action
              className="primary-action"
              disabled={!canRequest || isRequesting}
              onPress={() => onRequest(item)}
              focusKey={`request-${item.mediaType}-${item.tmdbId}`}
            >
              {requestLabel(item.mediaType, item.availability, Boolean(isRequesting))}
            </Action>
            {requestError ? <p className="request-error">{requestError}</p> : null}
          </div>
        </div>
      </div>
    </section>
  )
}

function requestLabel(mediaType: MediaType, availability: Availability, isRequesting: boolean) {
  if (isRequesting) {
    return 'Requesting...'
  }

  if (availability === 'available') {
    return 'Available in Jellyfin'
  }

  if (availability === 'partiallyAvailable') {
    return mediaType === 'tv' ? 'Request more seasons' : 'Available in Jellyfin'
  }

  if (availability === 'requested') {
    return 'Already requested'
  }

  if (availability === 'processing') {
    return 'Processing'
  }

  return 'Request in Seerr'
}
```

`packages/ui/src/components/MediaPosterButton.tsx` — Meta-Zeile ersetzen (Import `labelForAvailability` entfällt, `StatusBadge` importieren):
```tsx
import { StatusBadge } from './StatusBadge'
```
```tsx
      <span className="media-card-title">{item.title}</span>
      <span className="media-card-meta">
        {item.year ? <span>{item.year}</span> : null}
        <StatusBadge availability={item.availability} />
      </span>
```

`packages/ui/src/index.ts`: Exporte ergänzen für `RequestStatusBadge`, `SeasonRequestPicker`, `labelForRequestStatus`, `selectableSeasonNumbers`, `toggleSeason` (Muster der Datei folgen).

`packages/ui/src/styles.css` — ans Ende anhängen:
```css
/* Slice 4: requests & availability */
.request-status-pending,
.request-status-approved {
  background: rgba(230, 180, 60, 0.18);
  color: #e6c46a;
}

.request-status-processing {
  background: rgba(110, 160, 230, 0.18);
  color: #8fb7ef;
}

.request-status-available {
  background: rgba(90, 200, 120, 0.18);
  color: #7fd68f;
}

.request-status-declined,
.request-status-failed {
  background: rgba(220, 90, 90, 0.18);
  color: #e08d8d;
}

.media-card-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.media-card-meta .status-badge {
  font-size: 0.62rem;
  padding: 0.1rem 0.4rem;
}

.request-title {
  font-weight: 600;
}

.request-meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.request-error {
  color: #e08d8d;
  font-size: 0.85rem;
}

.season-picker-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
}

.season-picker {
  background: #14151c;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 1.5rem;
  width: min(28rem, 90vw);
  max-height: 80vh;
  overflow-y: auto;
}

.season-picker ul {
  list-style: none;
  margin: 1rem 0;
  padding: 0;
  display: grid;
  gap: 0.4rem;
}

.season-option {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.season-option.selected {
  outline: 2px solid var(--accent, #7b6cff);
}

.season-picker-actions {
  display: flex;
  gap: 0.6rem;
  margin-top: 1rem;
}

.home-header-row {
  display: flex;
  gap: 0.6rem;
  margin-bottom: 1rem;
}

.search-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
}
```
(Falls `--accent` nicht existiert: vorhandene Akzentfarbe aus styles.css verwenden — nachschlagen, nicht raten.)

- [ ] **Step 5: Grün + Gates** — `pnpm --filter @lolarr/ui test` → PASS. **Hinweis:** `pnpm typecheck`/Builds schlagen jetzt in `packages/features` fehl (RequestList braucht `Action`, DetailPanel-Signatur) — das behebt Task 6/7. Damit dieser Task eigenständig grün ist: in `packages/features/src/home/HomeScreen.tsx` die `RequestList`-Verwendung minimal anpassen (`<RequestList requests={requests} Action={Action} />`) — die volle Home-Umstellung folgt in Task 7. Danach: `pnpm test && pnpm typecheck && pnpm lint && pnpm --filter @lolarr/web build && pnpm --filter @lolarr/tv build` → PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui packages/features pnpm-lock.yaml
git commit -m "feat: request status badges, cancelable request list, and season picker ui"
```

---

### Task 6: useRequests-Erweiterung + DetailScreen-Staffel-Overlay + Navigation

**Files:**
- Modify: `packages/features/src/requests/useRequests.ts`, `packages/features/src/detail/DetailScreen.tsx`, `packages/features/src/navigation/store.ts`
- Test: `packages/features/tests/store.test.ts` (erweitern)

**Interfaces:**
- Consumes: `api.deleteRequest`, `SeasonRequestPicker`, `MediaDetailResponse.seasons`.
- Produces: `useRequests` liefert zusätzlich `requestError`, `cancelRequest(id)`, `cancelingId`, `cancelError`; `createRequest(item, seasons?, options?: { onSuccess?: () => void })`. Store: Screen-Union + `{ name: 'search' }` + `{ name: 'requests' }`.

- [ ] **Step 1: Failing Test** — in `packages/features/tests/store.test.ts` ergänzen:

```ts
it('supports search and requests screens', () => {
  const store = useScreenStore.getState()
  store.push({ name: 'search' })
  store.push({ name: 'requests' })
  const stack = useScreenStore.getState().stack
  expect(stack[stack.length - 2]).toEqual({ name: 'search' })
  expect(stack[stack.length - 1]).toEqual({ name: 'requests' })
})
```

- [ ] **Step 2: Rot** — `pnpm --filter @lolarr/features test` → FAIL (TS: Screen-Union kennt `search`/`requests` nicht → Test kompiliert nicht bzw. schlägt fehl).

- [ ] **Step 3: Implementieren**

`packages/features/src/navigation/store.ts` — Union erweitern:
```ts
export type Screen =
  | { name: 'home' }
  | { name: 'detail'; item: MediaItem }
  | { name: 'libraryDetail'; itemId: string }
  | { name: 'player'; itemId: string; resumeTicks?: number; seriesId?: string }
  | { name: 'search' }
  | { name: 'requests' }
```

`packages/features/src/requests/useRequests.ts` komplett ersetzen:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MediaItem } from '@lolarr/domain'
import { useApi } from '../api.js'

export function useRequests({ apiBaseUrl, enabled }: { apiBaseUrl: string; enabled: boolean }) {
  const queryClient = useQueryClient()
  const api = useApi()

  const requestsQuery = useQuery({
    queryKey: ['requests', apiBaseUrl],
    queryFn: () => api.requests(),
    enabled,
  })

  function invalidateAfterChange() {
    void queryClient.invalidateQueries({ queryKey: ['requests'] })
    void queryClient.invalidateQueries({ queryKey: ['home'] })
    void queryClient.invalidateQueries({ queryKey: ['search'] })
    void queryClient.invalidateQueries({ queryKey: ['media'] })
  }

  const requestMutation = useMutation({
    mutationFn: ({ item, seasons }: { item: MediaItem; seasons?: number[] }) => {
      if (item.tmdbId === undefined) {
        return Promise.reject(new Error('Cannot create a request for an item without a tmdbId'))
      }
      return api.createRequest({
        mediaType: item.mediaType,
        tmdbId: item.tmdbId,
        title: item.title,
        seasons,
      })
    },
    onSuccess: invalidateAfterChange,
  })

  const cancelMutation = useMutation({
    mutationFn: (requestId: string) => api.deleteRequest(requestId),
    onSuccess: invalidateAfterChange,
  })

  return {
    requests: requestsQuery.data?.requests ?? [],
    requestsError: requestsQuery.error,
    isRequestsLoading: requestsQuery.isLoading,
    createRequest: (item: MediaItem, seasons?: number[], options?: { onSuccess?: () => void }) =>
      requestMutation.mutate({ item, seasons }, { onSuccess: options?.onSuccess }),
    isRequesting: requestMutation.isPending,
    requestError: requestMutation.error,
    cancelRequest: (requestId: string) => cancelMutation.mutate(requestId),
    cancelingId: cancelMutation.isPending ? cancelMutation.variables : undefined,
    cancelError:
      cancelMutation.error && cancelMutation.variables !== undefined
        ? { id: cancelMutation.variables, message: cancelMutation.error.message }
        : undefined,
  }
}
```

`packages/features/src/detail/DetailScreen.tsx` komplett ersetzen:
```tsx
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { MediaItem } from '@lolarr/domain'
import { AppFrame, DetailPanel, SeasonRequestPicker, type ActionComponent } from '@lolarr/ui'
import { useApi } from '../api.js'
import { readErrorMessage } from '../lib/errors.js'
import { useRequests } from '../requests/useRequests.js'

export function DetailScreen({
  Action,
  apiBaseUrl,
  item: selectedItem,
  userName,
  onSignOut,
  canConfigureGateway,
  onConfigureGateway,
  onBack,
}: {
  Action: ActionComponent
  apiBaseUrl: string
  item: MediaItem
  userName: string
  onSignOut: () => void
  canConfigureGateway: boolean
  onConfigureGateway: () => void
  onBack: () => void
}) {
  const api = useApi()

  const tmdbId = selectedItem.tmdbId

  const detailQuery = useQuery({
    queryKey: ['media', apiBaseUrl, selectedItem.mediaType, tmdbId],
    queryFn: () => api.media(selectedItem.mediaType, tmdbId as number),
    enabled: tmdbId !== undefined,
  })

  const { createRequest, isRequesting, requestError } = useRequests({ apiBaseUrl, enabled: true })
  const [showSeasonPicker, setShowSeasonPicker] = useState(false)

  const detailItem = detailQuery.data?.item ?? selectedItem
  const seasons = detailQuery.data?.seasons ?? []

  function handleRequest(item: MediaItem) {
    if (item.mediaType === 'tv' && seasons.length > 0) {
      setShowSeasonPicker(true)
      return
    }
    createRequest(item)
  }

  return (
    <AppFrame
      Action={Action}
      onConfigureGateway={canConfigureGateway ? onConfigureGateway : undefined}
      userName={userName}
      onSignOut={onSignOut}
    >
      <DetailPanel
        item={detailItem}
        isRequesting={isRequesting}
        requestError={
          !showSeasonPicker && requestError ? readErrorMessage(requestError) : undefined
        }
        onBack={onBack}
        onRequest={handleRequest}
        Action={Action}
      />
      {showSeasonPicker ? (
        <SeasonRequestPicker
          seasons={seasons}
          isRequesting={isRequesting}
          errorMessage={requestError ? readErrorMessage(requestError) : undefined}
          onConfirm={(selection) =>
            createRequest(detailItem, selection, { onSuccess: () => setShowSeasonPicker(false) })
          }
          onClose={() => setShowSeasonPicker(false)}
          Action={Action}
        />
      ) : null}
    </AppFrame>
  )
}
```

- [ ] **Step 4: Grün + Gates** — `pnpm --filter @lolarr/features test` → PASS; dann `pnpm test && pnpm typecheck && pnpm lint && pnpm --filter @lolarr/web build && pnpm --filter @lolarr/tv build` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/features
git commit -m "feat: season picker request flow and request cancelation hook"
```

---

### Task 7: SearchScreen + RequestsScreen + Home-Umbau + Wiring

**Files:**
- Create: `packages/features/src/search/SearchScreen.tsx`, `packages/features/src/requests/RequestsScreen.tsx`
- Modify: `packages/features/src/home/HomeScreen.tsx`, `packages/features/src/experience.tsx`

**Interfaces:**
- Consumes: Store-Screens `search`/`requests` (Task 6), `RequestList`-Props (Task 5), `useRequests` (Task 6).
- Produces: `SearchScreen`, `RequestsScreen`; `HomeScreen` OHNE `TextInput`-Prop, MIT `onOpenSearch: () => void` und `onOpenRequests: () => void`.

- [ ] **Step 1: SearchScreen** — `packages/features/src/search/SearchScreen.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import type { MediaItem } from '@lolarr/domain'
import {
  AppFrame,
  ErrorPanel,
  LoadingPanel,
  MediaPosterButton,
  SearchBar,
  type ActionComponent,
  type TextInputComponent,
} from '@lolarr/ui'
import { useApi } from '../api.js'
import { readErrorMessage } from '../lib/errors.js'

export function SearchScreen({
  Action,
  TextInput,
  apiBaseUrl,
  userName,
  onSignOut,
  canConfigureGateway,
  onConfigureGateway,
  onBack,
  onOpenItem,
}: {
  Action: ActionComponent
  TextInput: TextInputComponent
  apiBaseUrl: string
  userName: string
  onSignOut: () => void
  canConfigureGateway: boolean
  onConfigureGateway: () => void
  onBack: () => void
  onOpenItem: (item: MediaItem) => void
}) {
  const api = useApi()
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim())

  const searchQuery = useQuery({
    queryKey: ['search', apiBaseUrl, deferredQuery],
    queryFn: () => api.search(deferredQuery),
    enabled: deferredQuery.length >= 2,
  })

  const results = searchQuery.data?.results ?? []

  return (
    <AppFrame
      Action={Action}
      onConfigureGateway={canConfigureGateway ? onConfigureGateway : undefined}
      userName={userName}
      onSignOut={onSignOut}
    >
      <Action className="ghost-action" onPress={onBack} focusKey="search-back">
        Back
      </Action>
      <SearchBar TextInput={TextInput} query={query} onQueryChange={setQuery} />
      {searchQuery.error ? <ErrorPanel message={readErrorMessage(searchQuery.error)} /> : null}
      {searchQuery.isLoading ? <LoadingPanel /> : null}
      {deferredQuery.length < 2 ? (
        <p className="empty-state">Type at least two characters to search.</p>
      ) : !searchQuery.isLoading && !searchQuery.error && results.length === 0 ? (
        <p className="empty-state">No results for “{deferredQuery}”.</p>
      ) : (
        <div className="search-grid">
          {results.map((item) => (
            <MediaPosterButton
              key={item.id}
              item={item}
              onOpen={onOpenItem}
              Action={Action}
              focusKeyPrefix="search"
            />
          ))}
        </div>
      )}
    </AppFrame>
  )
}
```

- [ ] **Step 2: RequestsScreen** — `packages/features/src/requests/RequestsScreen.tsx`:

```tsx
import { AppFrame, ErrorPanel, LoadingPanel, RequestList, type ActionComponent } from '@lolarr/ui'
import { readErrorMessage } from '../lib/errors.js'
import { useRequests } from './useRequests.js'

export function RequestsScreen({
  Action,
  apiBaseUrl,
  userName,
  onSignOut,
  canConfigureGateway,
  onConfigureGateway,
  onBack,
}: {
  Action: ActionComponent
  apiBaseUrl: string
  userName: string
  onSignOut: () => void
  canConfigureGateway: boolean
  onConfigureGateway: () => void
  onBack: () => void
}) {
  const { requests, requestsError, isRequestsLoading, cancelRequest, cancelingId, cancelError } =
    useRequests({ apiBaseUrl, enabled: true })

  return (
    <AppFrame
      Action={Action}
      onConfigureGateway={canConfigureGateway ? onConfigureGateway : undefined}
      userName={userName}
      onSignOut={onSignOut}
    >
      <Action className="ghost-action" onPress={onBack} focusKey="requests-back">
        Back
      </Action>
      {requestsError ? <ErrorPanel message={readErrorMessage(requestsError)} /> : null}
      {isRequestsLoading ? <LoadingPanel /> : null}
      {!requestsError && !isRequestsLoading ? (
        <RequestList
          requests={requests}
          Action={Action}
          onCancel={(request) => cancelRequest(request.id)}
          cancelingId={cancelingId}
          cancelError={cancelError}
        />
      ) : null}
    </AppFrame>
  )
}
```

- [ ] **Step 3: HomeScreen umbauen** — `packages/features/src/home/HomeScreen.tsx` komplett ersetzen:

```tsx
import { useMemo } from 'react'
import type { MediaItem } from '@lolarr/domain'
import { readJellyfinSession } from '@lolarr/jellyfin'
import {
  AppFrame,
  ErrorPanel,
  HeroPanel,
  LoadingPanel,
  MediaRail,
  RequestList,
  type ActionComponent,
} from '@lolarr/ui'
import { enrichItems, resolveItemImages } from '../lib/images.js'
import { readErrorMessage } from '../lib/errors.js'
import { useRequests } from '../requests/useRequests.js'
import type { KeyValueStorage } from '../storage.js'
import { useHome } from './useHome.js'

export function HomeScreen({
  Action,
  storage,
  apiBaseUrl,
  userName,
  onSignOut,
  canConfigureGateway,
  onConfigureGateway,
  onOpenItem,
  onPlayItem,
  onOpenSearch,
  onOpenRequests,
}: {
  Action: ActionComponent
  storage: KeyValueStorage
  apiBaseUrl: string
  userName: string
  onSignOut: () => void
  canConfigureGateway: boolean
  onConfigureGateway: () => void
  onOpenItem: (item: MediaItem) => void
  onPlayItem: (item: MediaItem) => void
  onOpenSearch: () => void
  onOpenRequests: () => void
}) {
  const homeQuery = useHome({ apiBaseUrl })
  // Read once per mount: HomeScreen only mounts after login, when lolarr.jellyfin is already persisted. If this screen ever survives a re-auth, switch to a subscribed read.
  const jellyfinSession = useMemo(() => readJellyfinSession(storage), [storage])

  const { requests, requestsError } = useRequests({ apiBaseUrl, enabled: true })

  const enrichedHome = useMemo(() => {
    const rows = (homeQuery.data?.rows ?? []).map((row) => ({
      ...row,
      items: enrichItems(row.items, jellyfinSession),
    }))
    const heroSource = homeQuery.data?.hero
    const hero = heroSource
      ? { ...heroSource, ...resolveItemImages(heroSource, jellyfinSession) }
      : undefined
    return { rows, hero }
  }, [homeQuery.data, jellyfinSession])

  const rows = enrichedHome.rows
  const featuredItem = enrichedHome.hero ?? rows[0]?.items[0]

  return (
    <AppFrame
      Action={Action}
      onConfigureGateway={canConfigureGateway ? onConfigureGateway : undefined}
      userName={userName}
      onSignOut={onSignOut}
    >
      <div className="home-header-row">
        <Action className="ghost-action" onPress={onOpenSearch} focusKey="home-search">
          Search
        </Action>
        <Action className="ghost-action" onPress={onOpenRequests} focusKey="home-requests">
          Requests
        </Action>
      </div>
      {homeQuery.error ? <ErrorPanel message={readErrorMessage(homeQuery.error)} /> : null}
      <HeroPanel
        item={featuredItem}
        onOpen={
          featuredItem?.jellyfin && (featuredItem.mediaType === 'movie' || featuredItem.jellyfin.episode)
            ? onPlayItem
            : onOpenItem
        }
        Action={Action}
      />
      {homeQuery.isLoading ? <LoadingPanel /> : null}
      {rows.map((row) => (
        <MediaRail
          key={row.id}
          id={row.id}
          title={row.title}
          items={row.items}
          onOpen={row.id === 'continue-watching' ? onPlayItem : onOpenItem}
          Action={Action}
        />
      ))}
      {requestsError ? null : (
        <RequestList requests={requests} Action={Action} limit={3} onViewAll={onOpenRequests} />
      )}
    </AppFrame>
  )
}
```
(Die Home-Suche entfällt hier bewusst — sie lebt jetzt im SearchScreen. `TextInput`, `useState`, `useDeferredValue`, `useQuery`, `useApi`, `SearchBar`-Import und `requestsError` im Fehler-Panel werden entfernt.)

- [ ] **Step 4: experience.tsx verdrahten** — in `packages/features/src/experience.tsx`:

Imports ergänzen:
```tsx
import { RequestsScreen } from './requests/RequestsScreen.js'
import { SearchScreen } from './search/SearchScreen.js'
```

Import oben ergänzen: `import type { MediaItem } from '@lolarr/domain'` (in die bestehende Type-Import-Zeile). Innerhalb der Komponente (vor den Screen-Branches) einen gemeinsamen Open-Handler definieren:
```tsx
  function openItem(item: MediaItem) {
    useScreenStore.getState().push(
      item.jellyfin
        ? { name: 'libraryDetail', itemId: item.jellyfin.itemId }
        : { name: 'detail', item },
    )
  }
```

Neue Branches VOR dem Home-Fallback:
```tsx
  if (currentScreen.name === 'search') {
    return (
      <SearchScreen
        Action={Action}
        TextInput={TextInput}
        apiBaseUrl={apiBaseUrl}
        userName={auth.user.name}
        onSignOut={handleSignOut}
        canConfigureGateway={canConfigureGateway}
        onConfigureGateway={onConfigureGateway}
        onBack={() => useScreenStore.getState().pop()}
        onOpenItem={openItem}
      />
    )
  }

  if (currentScreen.name === 'requests') {
    return (
      <RequestsScreen
        Action={Action}
        apiBaseUrl={apiBaseUrl}
        userName={auth.user.name}
        onSignOut={handleSignOut}
        canConfigureGateway={canConfigureGateway}
        onConfigureGateway={onConfigureGateway}
        onBack={() => useScreenStore.getState().pop()}
      />
    )
  }
```

Home-Branch anpassen: `TextInput={TextInput}` entfernen, `onOpenItem={openItem}` verwenden (ersetzt den bisherigen Inline-Handler), neu:
```tsx
      onOpenSearch={() => useScreenStore.getState().push({ name: 'search' })}
      onOpenRequests={() => useScreenStore.getState().push({ name: 'requests' })}
```

- [ ] **Step 5: Gates** — `pnpm test && pnpm typecheck && pnpm lint && pnpm --filter @lolarr/web build && pnpm --filter @lolarr/tv build` → alles PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/features
git commit -m "feat: search and requests screens with home header navigation"
```
