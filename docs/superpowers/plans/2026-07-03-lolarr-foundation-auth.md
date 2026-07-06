# Lolarr Slice 1: Fundament + Auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrukturiertes Monorepo + vollständiger Auth-Flow: Jellyfin-Passwort-Login (Web), Quick Connect (TV), Seerr-Session via Silent-QC, Demo-Modus entfernt, Vitest-Integrationstests.

**Architecture:** Fastify-BFF (`apps/api`) spricht mit Jellyfin + Seerr; Clients reden nur mit dem BFF. Seerr-Sessions (`connect.sid`) werden pro User beschafft — per Passwort-Login oder passwortlos via Seerrs Quick-Connect-Login (BFF autorisiert den QC-Code selbst mit dem gespeicherten Jellyfin-Token). Frontend-Logik liegt in `packages/features` (Feature-Module + Screen-Store), UI-Komponenten in `packages/ui`.

**Tech Stack:** Fastify 5, Zod 4, node:sqlite, undici MockAgent (Tests), Vitest, React 19, @tanstack/react-query 5, zustand.

**Spec:** `docs/superpowers/specs/2026-07-03-lolarr-foundation-auth-design.md` — bei Widerspruch gewinnt die Spec.

## Global Constraints

- Seerr ≥ v3.4.0 vorausgesetzt (QC-Endpoints `/api/v1/auth/jellyfin/quickconnect/*`); kein Fallback für ältere Versionen.
- Jellyfin-Header ausschließlich `Authorization: MediaBrowser …` — niemals `X-Emby-*`.
- Demo-Modus wird ersatzlos entfernt; API startet nicht ohne `JELLYFIN_URL`, `SEERR_URL`, `SEERR_API_KEY`, `LOLARR_SECRET` (min. 16 Zeichen, kein Default).
- Alle Routen unter `/api/*` außer `/api/auth/*` und `/health` verlangen eine Session.
- Node ≥ 22 (node:sqlite). Package-Manager: pnpm. Tests: `pnpm --filter @lolarr/api test`.
- Commits: Conventional Commits, englisch. Nach jedem Task committen. Vor jedem Commit: `pnpm typecheck` (root) muss grün sein.
- ESM überall: relative Imports in `apps/api` mit `.js`-Endung (bestehender Stil).
- Bewusste Abweichung von der Spec: Body-/Query-Validierung läuft über `schema.parse(...)` + zentralen ZodError-Handler (400) statt `fastify-type-provider-zod` — gleiche Semantik, eine Abhängigkeit weniger. Nicht nachträglich einführen.

---

## Phase 1 — Mechanischer Umbau

### Task 1: Vitest-Setup + Crypto-Unit-Tests

**Files:**
- Modify: `package.json` (root)
- Modify: `apps/api/package.json`
- Create: `apps/api/vitest.config.ts`
- Test: `apps/api/tests/crypto.test.ts`

**Interfaces:**
- Consumes: `encryptText`, `decryptText`, `hashValue` aus `apps/api/src/services/crypto.ts` (existieren).
- Produces: lauffähiges `pnpm --filter @lolarr/api test`; Muster für alle weiteren Tests.

- [ ] **Step 1: Vitest installieren**

```bash
pnpm add -D -w vitest@^3
pnpm --filter @lolarr/api add -D vitest@^3
```

- [ ] **Step 2: Config + Script**

`apps/api/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
```

In `apps/api/package.json` unter `"scripts"` ergänzen: `"test": "vitest run"`.

- [ ] **Step 3: Failing Test schreiben**

`apps/api/tests/crypto.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { decryptText, encryptText, hashValue } from '../src/services/crypto.js'

describe('crypto', () => {
  it('round-trips encrypted text', () => {
    const secret = 'test-secret-at-least-16-chars'
    expect(decryptText(encryptText('hello', secret), secret)).toBe('hello')
  })

  it('produces unique ciphertexts per call (random iv)', () => {
    const secret = 'test-secret-at-least-16-chars'
    expect(encryptText('hello', secret)).not.toBe(encryptText('hello', secret))
  })

  it('fails to decrypt with a different secret', () => {
    const encrypted = encryptText('hello', 'secret-number-one-16')
    expect(() => decryptText(encrypted, 'secret-number-two-16')).toThrow()
  })

  it('hashes deterministically', () => {
    expect(hashValue('abc')).toBe(hashValue('abc'))
    expect(hashValue('abc')).not.toBe(hashValue('abd'))
  })
})
```

- [ ] **Step 4: Tests laufen lassen**

Run: `pnpm --filter @lolarr/api test`
Expected: 4 passed (Implementierung existiert bereits — dieser Task etabliert nur die Infrastruktur; „failing first" gilt ab Task 2).

- [ ] **Step 5: Commit**

```bash
git add package.json apps/api/package.json apps/api/vitest.config.ts apps/api/tests/crypto.test.ts pnpm-lock.yaml
git commit -m "test: add vitest infrastructure with crypto unit tests"
```

---

### Task 2: Demo-Modus entfernen, Config verpflichtend

**Files:**
- Modify: `apps/api/src/config.ts` (komplett ersetzen)
- Modify: `packages/domain/src/index.ts:113-253` (löschen)
- Modify: `apps/api/src/adapters/seerr.ts`
- Modify: `apps/api/src/adapters/jellyfin.ts:16-24` (Demo-Branch löschen)
- Modify: `docker-compose.yml` (Secret-Default entfernen)
- Test: `apps/api/tests/config.test.ts`

**Interfaces:**
- Produces: `loadConfig(env?: NodeJS.ProcessEnv): AppConfig` — wirft bei fehlender Pflicht-Config. `AppConfig` hat `JELLYFIN_URL: string`, `SEERR_URL: string`, `SEERR_API_KEY: string`, `LOLARR_SECRET: string` (alle non-optional). `hasExternalServices` entfällt.

- [ ] **Step 1: Failing Test**

`apps/api/tests/config.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'

const validEnv = {
  JELLYFIN_URL: 'http://jellyfin.test',
  SEERR_URL: 'http://seerr.test',
  SEERR_API_KEY: 'test-api-key',
  LOLARR_SECRET: 'test-secret-at-least-16-chars',
}

describe('loadConfig', () => {
  it('accepts a complete environment', () => {
    const config = loadConfig(validEnv)
    expect(config.JELLYFIN_URL).toBe('http://jellyfin.test')
  })

  it.each(['JELLYFIN_URL', 'SEERR_URL', 'SEERR_API_KEY', 'LOLARR_SECRET'])(
    'throws when %s is missing',
    (key) => {
      const env = { ...validEnv }
      delete env[key as keyof typeof validEnv]
      expect(() => loadConfig(env)).toThrow()
    },
  )

  it('rejects short secrets', () => {
    expect(() => loadConfig({ ...validEnv, LOLARR_SECRET: 'short' })).toThrow()
  })
})
```

- [ ] **Step 2: Test läuft rot**

Run: `pnpm --filter @lolarr/api test tests/config.test.ts`
Expected: FAIL — `loadConfig` akzeptiert derzeit fehlende Werte (optional + Default-Secret).

- [ ] **Step 3: config.ts ersetzen**

`apps/api/src/config.ts` (kompletter Inhalt):
```ts
import { z } from 'zod'

const envSchema = z.object({
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(4000),
  JELLYFIN_URL: z.string().url(),
  SEERR_URL: z.string().url(),
  SEERR_API_KEY: z.string().min(1),
  LOLARR_SECRET: z.string().min(16),
  LOLARR_DATABASE_PATH: z.string().default('./data/lolarr.sqlite'),
})

export type AppConfig = z.infer<typeof envSchema>

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env)

  if (!result.success) {
    const missing = result.error.issues
      .map((issue) => issue.path.join('.'))
      .join(', ')
    throw new Error(
      `Lolarr API misconfigured — check these environment variables: ${missing}`,
    )
  }

  return result.data
}
```

- [ ] **Step 4: Demo-Daten aus domain löschen**

In `packages/domain/src/index.ts` alles ab `export const demoUser` bis Dateiende löschen (Zeilen 113–253: `demoUser`, `demoRows`, `findDemoItem`, `searchDemoItems`).

- [ ] **Step 5: Demo-Fallbacks aus den Adaptern entfernen**

`apps/api/src/adapters/jellyfin.ts`: den Block `if (!config.JELLYFIN_URL) { … }` (Zeilen 16–24) ersatzlos löschen.

`apps/api/src/adapters/seerr.ts`:
- Import auf `import type { MediaItem, MediaRow, MediaType, RequestStatus } from '@lolarr/domain'` reduzieren.
- Methode `isConfigured()` löschen; alle `if (!this.isConfigured()) { return … }`-Blöcke löschen.
- Die `try { … } catch { return demoRows }`-Wrapper in `discover()`, `search()`, `media()` entfernen — Fehler propagieren (zentraler Error-Handler kommt in Task 4). `discover()` wird zu:

```ts
async discover(): Promise<MediaRow[]> {
  const [trending, movies, shows] = await Promise.all([
    this.fetchList('/api/v1/discover/trending'),
    this.fetchList('/api/v1/discover/movies'),
    this.fetchList('/api/v1/discover/tv'),
  ])

  return [
    { id: 'trending', title: 'Trending now', items: trending },
    { id: 'popular-movies', title: 'Popular movies', items: movies },
    { id: 'popular-shows', title: 'Popular series', items: shows },
  ].filter((row) => row.items.length > 0)
}
```

`search()` und `media()` analog: nur noch der bisherige try-Body ohne try/catch. In `requestMedia()` den `if (!this.isConfigured())`-Block löschen. `this.config.SEERR_API_KEY ?? ''` → `this.config.SEERR_API_KEY`.

- [ ] **Step 6: docker-compose Secret-Default entfernen**

In `docker-compose.yml`: `LOLARR_SECRET: ${LOLARR_SECRET:-development-lolarr-secret}` → `LOLARR_SECRET: ${LOLARR_SECRET:?LOLARR_SECRET is required}` und `JELLYFIN_URL: ${JELLYFIN_URL:-}` → `JELLYFIN_URL: ${JELLYFIN_URL:?}` (analog `SEERR_URL`, `SEERR_API_KEY`).

- [ ] **Step 7: Verifizieren**

Run: `pnpm --filter @lolarr/api test && pnpm typecheck`
Expected: alle Tests PASS, Typecheck grün (keine Referenzen mehr auf gelöschte Exporte).

- [ ] **Step 8: Commit**

```bash
git add -A apps/api packages/domain docker-compose.yml
git commit -m "feat!: remove demo mode, require full configuration at startup"
```

---

### Task 3: Seerr-Status-Mapping vervollständigen

**Files:**
- Modify: `packages/domain/src/index.ts:6-13` (Availability-Enum)
- Modify: `apps/api/src/adapters/seerr.ts:225-239` (`mapAvailability` → exportiertes `mapSeerrAvailability`)
- Modify: `packages/ui/src/components/streaming.tsx` (`labelForAvailability`, `requestLabel`)
- Test: `apps/api/tests/seerr-availability.test.ts`

**Interfaces:**
- Produces: `Availability`-Enum um `'partiallyAvailable'` erweitert; `export function mapSeerrAvailability(status: number | undefined): Availability` in `apps/api/src/adapters/seerr.ts`.

Seerr `MediaStatus`: `1=UNKNOWN, 2=PENDING, 3=PROCESSING, 4=PARTIALLY_AVAILABLE, 5=AVAILABLE, 6=BLOCKLISTED, 7=DELETED`.

- [ ] **Step 1: Failing Test**

`apps/api/tests/seerr-availability.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { mapSeerrAvailability } from '../src/adapters/seerr.js'

describe('mapSeerrAvailability', () => {
  it.each([
    [undefined, 'requestable'],
    [1, 'requestable'],
    [2, 'requested'],
    [3, 'processing'],
    [4, 'partiallyAvailable'],
    [5, 'available'],
    [6, 'unavailable'],
    [7, 'requestable'],
  ] as const)('maps status %s to %s', (status, expected) => {
    expect(mapSeerrAvailability(status)).toBe(expected)
  })
})
```

- [ ] **Step 2: Rot laufen lassen** — `pnpm --filter @lolarr/api test tests/seerr-availability.test.ts` → FAIL (`mapSeerrAvailability` nicht exportiert).

- [ ] **Step 3: Implementieren**

`packages/domain/src/index.ts` — Enum erweitern:
```ts
export const availabilitySchema = z.enum([
  'available',
  'partiallyAvailable',
  'requestable',
  'requested',
  'processing',
  'unavailable',
])
```

`apps/api/src/adapters/seerr.ts` — `mapAvailability` ersetzen durch:
```ts
export function mapSeerrAvailability(
  status: number | undefined,
): MediaItem['availability'] {
  switch (status) {
    case 2:
      return 'requested'
    case 3:
      return 'processing'
    case 4:
      return 'partiallyAvailable'
    case 5:
      return 'available'
    case 6:
      return 'unavailable'
    default:
      return 'requestable'
  }
}
```
Aufrufstelle in `mapSeerrItem` anpassen: `availability: mapSeerrAvailability(status)`.

`packages/ui/src/components/streaming.tsx` — in `labelForAvailability` einen Case ergänzen: `partiallyAvailable` → `'Partially available'`; in `requestLabel` denselben Status wie `available` behandeln (kein Request-Button-Label „Request").

- [ ] **Step 4: Grün + Typecheck** — `pnpm --filter @lolarr/api test && pnpm typecheck` → PASS (Typecheck erzwingt vollständige Switch-Abdeckung in ui).

- [ ] **Step 5: Commit**

```bash
git add apps/api packages/domain packages/ui
git commit -m "fix: map all seven Seerr media statuses incl. partially available"
```

---

### Task 4: Zentraler Error-Handler + Test-Server-Helper

**Files:**
- Create: `apps/api/src/lib/errors.ts`
- Create: `apps/api/src/plugins/errors.ts`
- Modify: `apps/api/src/server.ts` (Plugin registrieren)
- Modify: `apps/api/src/adapters/seerr.ts` (`UpstreamError` werfen)
- Create: `apps/api/tests/helpers.ts`
- Test: `apps/api/tests/errors.test.ts`

**Interfaces:**
- Produces:
  - `class UpstreamError extends Error { service: 'jellyfin' | 'seerr'; status?: number }` (Konstruktor: `(service, status, message)`)
  - `class InvalidCredentialsError extends Error`
  - `class JellyfinTokenInvalidError extends Error { userId: string }` (Konstruktor: `(userId)`)
  - `errorHandlerPlugin: FastifyPluginAsync`
  - Test-Helper: `createTestContext(): { config: AppConfig; mockAgent: MockAgent; jellyfin: Interceptable; seerr: Interceptable; cleanup(): Promise<void> }` und `buildServer(config)`-Nutzung via `createServer` + `app.inject`.

- [ ] **Step 1: Error-Klassen**

`apps/api/src/lib/errors.ts`:
```ts
export class UpstreamError extends Error {
  constructor(
    readonly service: 'jellyfin' | 'seerr',
    readonly status: number | undefined,
    message: string,
  ) {
    super(message)
    this.name = 'UpstreamError'
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid Jellyfin credentials')
    this.name = 'InvalidCredentialsError'
  }
}

export class JellyfinTokenInvalidError extends Error {
  constructor(readonly userId: string) {
    super('Stored Jellyfin token is no longer valid')
    this.name = 'JellyfinTokenInvalidError'
  }
}
```

- [ ] **Step 2: Test-Helper**

`apps/api/tests/helpers.ts`:
```ts
import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MockAgent, setGlobalDispatcher } from 'undici'
import type { AppConfig } from '../src/config.js'

export const JELLYFIN_URL = 'http://jellyfin.test'
export const SEERR_URL = 'http://seerr.test'

export function createTestContext() {
  const databasePath = join(tmpdir(), `lolarr-test-${randomUUID()}.sqlite`)

  const config: AppConfig = {
    HOST: '127.0.0.1',
    PORT: 0,
    JELLYFIN_URL,
    SEERR_URL,
    SEERR_API_KEY: 'test-api-key',
    LOLARR_SECRET: 'test-secret-at-least-16-chars',
    LOLARR_DATABASE_PATH: databasePath,
  }

  const mockAgent = new MockAgent()
  mockAgent.disableNetConnect()
  setGlobalDispatcher(mockAgent)

  return {
    config,
    mockAgent,
    jellyfin: mockAgent.get(JELLYFIN_URL),
    seerr: mockAgent.get(SEERR_URL),
    async cleanup() {
      await mockAgent.close()
      rmSync(databasePath, { force: true })
    },
  }
}

export function jellyfinAuthResponse(overrides: Record<string, unknown> = {}) {
  return {
    AccessToken: 'jf-access-token',
    User: { Id: 'jf-user-1', Name: 'Joel' },
    ...overrides,
  }
}
```

`undici` als devDependency: `pnpm --filter @lolarr/api add -D undici` (globaler `fetch` in Node ist undici; `setGlobalDispatcher` greift).

- [ ] **Step 3: Failing Test**

`apps/api/tests/errors.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../src/server.js'
import { createTestContext } from './helpers.js'

describe('error handling', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('returns 400 for invalid request bodies', async () => {
    const app = createServer(ctx.config)
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 42 },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json()).toHaveProperty('error')
  })

  it('returns 502 when an upstream service fails', async () => {
    ctx.jellyfin
      .intercept({ path: '/Users/AuthenticateByName', method: 'POST' })
      .reply(500, 'boom')
    const app = createServer(ctx.config)
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'joel', password: 'pw', deviceId: 'device-123' },
    })
    // Hinweis: deviceId wird erst in Task 13 Teil des Schemas; bis dahin ignoriert Zod das Feld.
    expect(response.statusCode).toBe(502)
    expect(response.json().error).toBe('jellyfin_unreachable')
  })
})
```

Run: `pnpm --filter @lolarr/api test tests/errors.test.ts`
Expected: FAIL — invalid body liefert aktuell 500 (Zod-Throw), Upstream-Fehler liefert 401 (catch-all im Login-Handler).

- [ ] **Step 4: Error-Handler-Plugin**

`apps/api/src/plugins/errors.ts`:
```ts
import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import {
  InvalidCredentialsError,
  JellyfinTokenInvalidError,
  UpstreamError,
} from '../lib/errors.js'

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'validation_failed',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      })
    }

    if (error instanceof InvalidCredentialsError) {
      return reply.code(401).send({ error: 'Invalid Jellyfin credentials' })
    }

    if (error instanceof JellyfinTokenInvalidError) {
      return reply.code(401).send({ error: 'session_expired' })
    }

    if (error instanceof UpstreamError) {
      request.log.error({ err: error }, 'upstream request failed')
      return reply.code(502).send({ error: `${error.service}_unreachable` })
    }

    request.log.error({ err: error }, 'unhandled error')
    return reply.code(500).send({ error: 'internal_error' })
  })
}
```

In `apps/api/src/server.ts` nach `app.register(cors, …)`: `registerErrorHandler(app)` (Import ergänzen). Im Login-Handler das `try/catch` entfernen — `authenticateWithJellyfin` wirft ab jetzt typisierte Fehler (Step 5).

- [ ] **Step 5: Adapter werfen typisierte Fehler**

`apps/api/src/adapters/jellyfin.ts` — Fehlerbehandlung ersetzen:
```ts
if (response.status === 401) {
  throw new InvalidCredentialsError()
}

if (!response.ok) {
  throw new UpstreamError('jellyfin', response.status, 'Jellyfin login failed')
}
```
(Import aus `../lib/errors.js`.) Der `fetch` selbst wird gewrappt:
```ts
let response: Response
try {
  response = await fetch(/* wie bisher */)
} catch (error) {
  throw new UpstreamError('jellyfin', undefined, `Jellyfin unreachable: ${String(error)}`)
}
```

`apps/api/src/adapters/seerr.ts` — in `request()`:
```ts
if (!response.ok) {
  throw new UpstreamError('seerr', response.status, `Seerr request failed: ${response.status}`)
}
```
und den `fetch` analog in try/catch mit `UpstreamError('seerr', undefined, …)` wrappen.

- [ ] **Step 6: Grün** — `pnpm --filter @lolarr/api test` → PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat: central error handler with typed upstream errors and test harness"
```

---

### Task 5: Auth-Hook — alle API-Routen geschützt

**Files:**
- Create: `apps/api/src/plugins/auth.ts`
- Modify: `apps/api/src/server.ts`
- Test: `apps/api/tests/auth-hook.test.ts`

**Interfaces:**
- Produces: `registerAuthHook(app, database)` — onRequest-Hook; hängt `request.session: StoredSession` an (Fastify-Module-Augmentation). Public: `/health`, alles unter `/api/auth/`. Route-Handler lesen `request.session` statt selbst zu prüfen.

- [ ] **Step 1: Failing Test**

`apps/api/tests/auth-hook.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../src/server.js'
import { createTestContext, jellyfinAuthResponse } from './helpers.js'

describe('auth hook', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it.each(['/api/discover', '/api/search?q=x', '/api/media/movie/1', '/api/requests'])(
    'rejects %s without a token',
    async (url) => {
      const app = createServer(ctx.config)
      const response = await app.inject({ method: 'GET', url })
      expect(response.statusCode).toBe(401)
    },
  )

  it('allows /health without a token', async () => {
    const app = createServer(ctx.config)
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(200)
  })

  it('allows authenticated requests through', async () => {
    ctx.jellyfin
      .intercept({ path: '/Users/AuthenticateByName', method: 'POST' })
      .reply(200, jellyfinAuthResponse(), { headers: { 'content-type': 'application/json' } })
    ctx.seerr
      .intercept({ path: '/api/v1/auth/jellyfin', method: 'POST' })
      .reply(200, {}, { headers: { 'set-cookie': 'connect.sid=s%3Aabc; Path=/' } })
    ctx.seerr
      .intercept({ path: /\/api\/v1\/discover\/.*/, method: 'GET' })
      .reply(200, { results: [] })
      .times(3)

    const app = createServer(ctx.config)
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'joel', password: 'pw', deviceId: 'device-123' },
    })
    const { token } = login.json()

    const response = await app.inject({
      method: 'GET',
      url: '/api/discover',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(response.statusCode).toBe(200)
  })
})
```
Hinweis: Der Seerr-Login-Intercept (`/api/v1/auth/jellyfin`) existiert erst ab Task 13 — bis dahin schlägt dieser Intercept einfach nicht an, was undici toleriert (kein `.times()`-Zwang). Der Test bleibt in allen Zwischenständen grün.

Run: `pnpm --filter @lolarr/api test tests/auth-hook.test.ts`
Expected: FAIL — `/api/discover` etc. liefern heute 200 ohne Token.

- [ ] **Step 2: Hook implementieren**

`apps/api/src/plugins/auth.ts`:
```ts
import type { FastifyInstance } from 'fastify'
import type { LolarrDatabase, StoredSession } from '../services/database.js'

declare module 'fastify' {
  interface FastifyRequest {
    session: StoredSession
  }
}

const PUBLIC_PREFIXES = ['/api/auth/']
const PUBLIC_PATHS = ['/health']

export function registerAuthHook(app: FastifyInstance, database: LolarrDatabase) {
  app.decorateRequest('session', undefined as unknown as StoredSession)

  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0] ?? request.url

    if (PUBLIC_PATHS.includes(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p))) {
      return
    }

    const token = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1]
    const session = token ? database.findSession(token) : undefined

    if (!session) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    request.session = session
  })
}
```

- [ ] **Step 3: server.ts umstellen**

In `createServer`: nach `registerErrorHandler(app)` → `registerAuthHook(app, database)`. Danach:
- `/api/session/me`: Body wird zu `return { user: request.session.user }`.
- `/api/requests` (GET+POST): eigene `authenticateRequest`-Aufrufe + 401-Zweige löschen, `session` → `request.session`.
- Funktion `authenticateRequest` am Dateiende löschen.

- [ ] **Step 4: Grün** — `pnpm --filter @lolarr/api test` → PASS (inkl. Task-4-Tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: require session on all API routes via central auth hook"
```

---

### Task 6: API-Module-Split + Requests-Sichtbarkeit

**Files:**
- Create: `apps/api/src/modules/auth.ts`, `apps/api/src/modules/discover.ts`, `apps/api/src/modules/media.ts`, `apps/api/src/modules/requests.ts`
- Modify: `apps/api/src/server.ts` (nur noch Komposition)
- Modify: `apps/api/src/services/database.ts:98-111` (`listRequests(userId)`)
- Test: `apps/api/tests/requests-visibility.test.ts`

**Interfaces:**
- Produces: `FastifyPluginAsync`-Exports `authRoutes`, `discoverRoutes`, `mediaRoutes`, `requestsRoutes`; jede erhält Abhängigkeiten via Options-Objekt `{ config, database, seerr }` (Typ `AppContext`, definiert in `apps/api/src/lib/context.ts`). `LolarrDatabase.listRequests(userId: string)` — nur eigene Requests.

- [ ] **Step 1: Failing Test**

`apps/api/tests/requests-visibility.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LolarrDatabase } from '../src/services/database.js'
import { createTestContext } from './helpers.js'

describe('request visibility', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('only returns requests created by the given user', () => {
    const db = new LolarrDatabase(ctx.config.LOLARR_DATABASE_PATH, ctx.config.LOLARR_SECRET)
    const userA = { id: 'user-a', name: 'A' }
    const userB = { id: 'user-b', name: 'B' }
    db.upsertUser(userA, 'token-a')
    db.upsertUser(userB, 'token-b')
    db.createRequest({ mediaType: 'movie', tmdbId: 1, title: 'One', status: 'pending', requestedBy: userA })
    db.createRequest({ mediaType: 'movie', tmdbId: 2, title: 'Two', status: 'pending', requestedBy: userB })

    const visible = db.listRequests(userA.id)
    expect(visible).toHaveLength(1)
    expect(visible[0]?.title).toBe('One')
  })
})
```

Run → FAIL (TypeScript: `listRequests` erwartet 0 Argumente; Verhalten: liefert beide).

- [ ] **Step 2: database.ts anpassen**

`listRequests(userId: string)`: SQL um `where requests.user_id = ?` ergänzen, `.all(userId)`. `createRequest(input)` gibt am Ende `this.listRequests(input.requestedBy.id)` zurück.

- [ ] **Step 3: Module extrahieren**

`apps/api/src/lib/context.ts`:
```ts
import type { AppConfig } from '../config.js'
import type { LolarrDatabase } from '../services/database.js'
import type { SeerrAdapter } from '../adapters/seerr.js'

export type AppContext = {
  config: AppConfig
  database: LolarrDatabase
  seerr: SeerrAdapter
}
```

`apps/api/src/modules/discover.ts` (Muster für alle Module):
```ts
import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../lib/context.js'

export async function discoverRoutes(app: FastifyInstance, { seerr }: AppContext) {
  app.get('/api/discover', async () => ({
    rows: await seerr.discover(),
  }))

  app.get('/api/search', async (request) => {
    const query = readQuery(request.query)
    return { query, results: await seerr.search(query) }
  })
}

function readQuery(query: unknown) {
  if (
    typeof query === 'object' &&
    query !== null &&
    'q' in query &&
    typeof query.q === 'string'
  ) {
    return query.q
  }
  return ''
}
```

`modules/media.ts`: `GET /api/media/:mediaType/:tmdbId`-Handler unverändert aus server.ts übernehmen. `modules/requests.ts`: GET/POST `/api/requests`-Handler übernehmen, `database.listRequests(request.session.user.id)` verwenden. `modules/auth.ts`: `POST /api/auth/login` + `GET /api/session/me` übernehmen.

`apps/api/src/server.ts` schrumpft auf:
```ts
import cors from '@fastify/cors'
import Fastify from 'fastify'
import type { AppConfig } from './config.js'
import { SeerrAdapter } from './adapters/seerr.js'
import type { AppContext } from './lib/context.js'
import { authRoutes } from './modules/auth.js'
import { discoverRoutes } from './modules/discover.js'
import { mediaRoutes } from './modules/media.js'
import { requestsRoutes } from './modules/requests.js'
import { registerAuthHook } from './plugins/auth.js'
import { registerErrorHandler } from './plugins/errors.js'
import { LolarrDatabase } from './services/database.js'

export function createServer(config: AppConfig) {
  const app = Fastify({ logger: true })
  const context: AppContext = {
    config,
    database: new LolarrDatabase(config.LOLARR_DATABASE_PATH, config.LOLARR_SECRET),
    seerr: new SeerrAdapter(config),
  }

  app.register(cors, { origin: true })
  registerErrorHandler(app)
  registerAuthHook(app, context.database)

  app.get('/health', async () => ({ ok: true }))

  app.register(authRoutes, context)
  app.register(discoverRoutes, context)
  app.register(mediaRoutes, context)
  app.register(requestsRoutes, context)

  return app
}
```
Hinweis: Fastify übergibt das zweite `register`-Argument als Plugin-Options — `AppContext` ist dafür ausreichend serialisierbar-frei (Klasseninstanzen sind erlaubt).

- [ ] **Step 4: Grün** — `pnpm --filter @lolarr/api test && pnpm typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "refactor: split API into route modules, scope requests to the session user"
```

---

### Task 7: features — Storage-Adapter + Screen-Store

**Files:**
- Modify: `packages/features/package.json` (zustand)
- Create: `packages/features/src/storage.ts`
- Create: `packages/features/src/navigation/store.ts`

**Interfaces:**
- Produces:
  - `interface KeyValueStorage { get(key: string): string | null; set(key: string, value: string): void; remove(key: string): void }`
  - `export const localStorageAdapter: KeyValueStorage` (SSR-sicher: no-op ohne `window`)
  - `export function getOrCreateDeviceId(storage: KeyValueStorage): string` (Key `lolarr.device-id`, `crypto.randomUUID()`)
  - Screen-Store: `type Screen = { name: 'home' } | { name: 'detail'; item: MediaItem }` und `useScreenStore` mit `{ stack: Screen[]; push(screen): void; pop(): void; reset(): void; current(): Screen }` — `pop()` auf letztem Element bleibt auf `home`.

- [ ] **Step 1: zustand installieren**

```bash
pnpm --filter @lolarr/features add zustand@^5
```

- [ ] **Step 2: storage.ts**

```ts
export interface KeyValueStorage {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

export const localStorageAdapter: KeyValueStorage = {
  get(key) {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key)
  },
  set(key, value) {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value)
    }
  },
  remove(key) {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key)
    }
  },
}

const deviceIdKey = 'lolarr.device-id'

export function getOrCreateDeviceId(storage: KeyValueStorage): string {
  const existing = storage.get(deviceIdKey)
  if (existing) {
    return existing
  }
  const deviceId = crypto.randomUUID()
  storage.set(deviceIdKey, deviceId)
  return deviceId
}
```

- [ ] **Step 3: navigation/store.ts**

```ts
import { create } from 'zustand'
import type { MediaItem } from '@lolarr/domain'

export type Screen = { name: 'home' } | { name: 'detail'; item: MediaItem }

type ScreenState = {
  stack: Screen[]
  push: (screen: Screen) => void
  pop: () => void
  reset: () => void
}

export const useScreenStore = create<ScreenState>((set) => ({
  stack: [{ name: 'home' }],
  push: (screen) => set((state) => ({ stack: [...state.stack, screen] })),
  pop: () =>
    set((state) => ({
      stack: state.stack.length > 1 ? state.stack.slice(0, -1) : state.stack,
    })),
  reset: () => set({ stack: [{ name: 'home' }] }),
}))

export function useCurrentScreen(): Screen {
  return useScreenStore((state) => state.stack[state.stack.length - 1] ?? { name: 'home' })
}
```

- [ ] **Step 4: Verifizieren + Commit**

Run: `pnpm typecheck`
Expected: grün (Dateien noch unbenutzt — Anschluss in Task 8).

```bash
git add packages/features pnpm-lock.yaml
git commit -m "feat: add storage adapter and screen navigation store"
```

---

### Task 8: features-Split — Screens und Hooks

**Files:**
- Modify: `packages/features/src/index.tsx` (wird reiner Re-Export)
- Create: `packages/features/src/app.tsx`
- Create: `packages/features/src/api.tsx` (Api-Context)
- Create: `packages/features/src/auth/useAuth.ts`, `packages/features/src/auth/LoginScreen.tsx`, `packages/features/src/auth/GatewayScreen.tsx`, `packages/features/src/auth/gateway.ts`
- Create: `packages/features/src/home/HomeScreen.tsx`
- Create: `packages/features/src/detail/DetailScreen.tsx`
- Create: `packages/features/src/requests/useRequests.ts`

**Interfaces:**
- Consumes: `useScreenStore`, `useCurrentScreen`, `KeyValueStorage`, `localStorageAdapter` aus Task 7.
- Produces: `LolarrApp`-Export bleibt **API-kompatibel** (`{ Action, TextInput?, Shell?, storage? }` — neue optionale Prop `storage: KeyValueStorage`, Default `localStorageAdapter`). Interner Api-Context: `const ApiContext = createContext<LolarrApiClient>`; Hook `useApi()`.

Dies ist ein mechanischer Umbau des bestehenden `index.tsx` (401 Zeilen) — **kein neues Verhalten**. Verschiebe-Anleitung (Quellzeilen beziehen sich auf den Ist-Stand):

- [ ] **Step 1: Hilfsfunktionen + Gateway-Logik verschieben**

`auth/gateway.ts` erhält unverändert: `normalizeApiBaseUrl` (Z. 383–401), `canUseRuntimeGatewayConfig` (371–373), `shouldRequireGatewaySetup` (375–377), `isFileProtocol` (379–381), `readInitialApiBaseUrl`/`readStoredApiBaseUrl`/`writeStoredApiBaseUrl` (331–349) — Letztere drei auf `KeyValueStorage`-Parameter umgestellt statt direktem `window.localStorage`. `readErrorMessage` (363–369) → neue Datei `src/lib/errors.ts`, Export.

- [ ] **Step 2: app.tsx — Provider + Screen-Switch**

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMemo, useState, type ComponentType } from 'react'
import { createLolarrApiClient } from '@lolarr/api-client'
import type { ActionComponent, ShellProps, TextInputComponent } from '@lolarr/ui'
import { DefaultTextInput } from '@lolarr/ui'
import { ApiProvider } from './api.js'
import { GatewayScreen } from './auth/GatewayScreen.js'
import { LoginScreen } from './auth/LoginScreen.js'
import { useAuth } from './auth/useAuth.js'
import { DetailScreen } from './detail/DetailScreen.js'
import { HomeScreen } from './home/HomeScreen.js'
import { useCurrentScreen } from './navigation/store.js'
import { localStorageAdapter, type KeyValueStorage } from './storage.js'

export type LolarrAppProps = {
  Action: ActionComponent
  TextInput?: TextInputComponent
  Shell?: ComponentType<ShellProps>
  storage?: KeyValueStorage
}

export function LolarrApp({
  Action,
  TextInput = DefaultTextInput,
  Shell = DefaultShell,
  storage = localStorageAdapter,
}: LolarrAppProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 30_000 },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <Shell>
        <LolarrExperience Action={Action} TextInput={TextInput} storage={storage} />
      </Shell>
    </QueryClientProvider>
  )
}

function DefaultShell({ children }: ShellProps) {
  return <>{children}</>
}
```

`LolarrExperience` behält die Struktur des bisherigen Codes (Z. 72–317), delegiert aber:
- Auth-State/-Mutationen → `useAuth(storage, apiBaseUrl)` (Token, `login`, `signOut`, `loginError`)
- Gateway-State bleibt in `LolarrExperience` (nutzt `auth/gateway.ts` mit `storage`)
- Screen-Rendering: `if (gatewaySetup) → <GatewayScreen …>`, `if (!user) → <LoginScreen …>`, sonst `switch (useCurrentScreen().name)`: `'detail'` → `<DetailScreen …>`, default → `<HomeScreen …>`
- `setSelectedItem(item)` wird zu `useScreenStore.getState().push({ name: 'detail', item })`; „Back" zu `pop()`; `signOut`/Gateway-Wechsel zu `reset()`.

- [ ] **Step 3: Hooks/Screens befüllen**

- `auth/useAuth.ts`: Token-State (Z. 85–86, 323–329, 351–361 auf `storage` umgestellt, Key `lolarr.session-token`), `sessionQuery` (104–110), `loginMutation` (136–151), `handleSignOut` (196–201). Rückgabe: `{ token, user, isSessionLoading, login(payload), loginError, signOut }`.
- `home/HomeScreen.tsx`: `discoverQuery`, `searchQuery`, `deferredQuery`-State (88–89, 112–128), Rows-Berechnung (280–291), JSX aus Z. 293–316 (`HeroPanel`, `SearchBar`, `MediaRail`, `RequestList`, `ErrorPanel`). Props: `{ Action, TextInput, userName, onSignOut, onConfigureGateway }`.
- `detail/DetailScreen.tsx`: `detailQuery` (130–134), `requestMutation` via `useRequests`, JSX aus Z. 261–278. Props: `{ Action, item, … }`.
- `requests/useRequests.ts`: `requestsQuery` (118–122) + `requestMutation` (153–166). Rückgabe `{ requests, createRequest, isRequesting }`.
- `api.tsx`: `ApiProvider` + `useApi()` — kapselt `createLolarrApiClient`-Memo (91–102); `onUnauthorized` ruft `signOut`-Callback.

`src/index.tsx` wird zu:
```tsx
export { LolarrApp, type LolarrAppProps } from './app.js'
export { localStorageAdapter, type KeyValueStorage } from './storage.js'
```

- [ ] **Step 4: Verifizieren**

Run: `pnpm typecheck && pnpm --filter @lolarr/web build && pnpm --filter @lolarr/tv build`
Expected: grün. Danach Smoke-Test: `pnpm dev:web` starten, Gateway-/Login-Screen erscheint, kein Konsolen-Fehler.

- [ ] **Step 5: Commit**

```bash
git add packages/features
git commit -m "refactor: split features god component into screens, hooks and navigation"
```

---

### Task 9: ui-Split — eine Datei pro Komponente

**Files:**
- Delete: `packages/ui/src/components/streaming.tsx`
- Create: `packages/ui/src/components/{types,DefaultAction,DefaultTextInput,AppFrame,GatewayPanel,LoginPanel,SearchBar,HeroPanel,MediaRail,MediaPosterButton,DetailPanel,RequestList,StatusBadge,LoadingPanel,ErrorPanel}.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Produces: identische Exporte wie heute (siehe `packages/ui/src/index.ts`), zusätzlich `MediaPosterButton`. `types.tsx` enthält `ActionProps`, `ActionComponent`, `TextInputProps`, `TextInputComponent`, `ShellProps`.

- [ ] **Step 1: Aufteilen** — jede exportierte Funktion aus `streaming.tsx` samt ihrem Props-Typ 1:1 in die gleichnamige Datei verschieben; gemeinsame Typen (Z. 4–37) nach `types.tsx`; private Helfer `requestLabel`/`labelForAvailability` (Z. 487–520) wandern zu `DetailPanel.tsx` bzw. `StatusBadge.tsx` (wer sie nutzt — bei Doppelnutzung nach `availabilityLabels.ts` exportieren und importieren). Imports pro Datei ergänzen.

- [ ] **Step 2: index.ts** — Re-Exports auf die neuen Dateien umstellen (gleiche Namensliste, Pfade `./components/AppFrame` usw.).

- [ ] **Step 3: Verifizieren** — `pnpm typecheck && pnpm lint` → grün.

- [ ] **Step 4: Commit**

```bash
git add packages/ui
git commit -m "refactor: one file per ui component"
```

---

## Phase 2 — Auth-Ausbau

### Task 10: DB — Seerr-Cookie-Spalte + Session-Helpers

**Files:**
- Modify: `apps/api/src/services/database.ts`
- Test: `apps/api/tests/database.test.ts`

**Interfaces:**
- Produces (auf `LolarrDatabase`):
  - `saveSeerrCookie(userId: string, cookie: string): void` (AES-GCM via `encryptText`)
  - `getSeerrCookie(userId: string): string | undefined`
  - `clearSeerrCookie(userId: string): void`
  - `deleteSessionsForUser(userId: string): void`
- Migration: Spalte `seerr_cookie text` (nullable) an `users`, idempotent.

- [ ] **Step 1: Failing Test**

`apps/api/tests/database.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LolarrDatabase } from '../src/services/database.js'
import { createTestContext } from './helpers.js'

describe('LolarrDatabase', () => {
  let ctx: ReturnType<typeof createTestContext>
  let db: LolarrDatabase
  const user = { id: 'user-1', name: 'Joel' }

  beforeEach(() => {
    ctx = createTestContext()
    db = new LolarrDatabase(ctx.config.LOLARR_DATABASE_PATH, ctx.config.LOLARR_SECRET)
    db.upsertUser(user, 'jf-token')
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('round-trips the seerr cookie encrypted', () => {
    db.saveSeerrCookie(user.id, 'connect.sid=s%3Aabc')
    expect(db.getSeerrCookie(user.id)).toBe('connect.sid=s%3Aabc')
  })

  it('returns undefined when no cookie is stored', () => {
    expect(db.getSeerrCookie(user.id)).toBeUndefined()
  })

  it('clears the seerr cookie', () => {
    db.saveSeerrCookie(user.id, 'connect.sid=s%3Aabc')
    db.clearSeerrCookie(user.id)
    expect(db.getSeerrCookie(user.id)).toBeUndefined()
  })

  it('deletes all sessions of a user', () => {
    const { token } = db.createSession(user)
    db.deleteSessionsForUser(user.id)
    expect(db.findSession(token)).toBeUndefined()
  })

  it('keeps upsertUser from wiping the seerr cookie', () => {
    db.saveSeerrCookie(user.id, 'connect.sid=s%3Aabc')
    db.upsertUser(user, 'new-jf-token')
    expect(db.getSeerrCookie(user.id)).toBe('connect.sid=s%3Aabc')
  })
})
```

Run → FAIL (Methoden existieren nicht).

- [ ] **Step 2: Implementieren**

In `migrate()` nach dem `create table`-Block:
```ts
const userColumns = this.database
  .prepare(`select name from pragma_table_info('users')`)
  .all() as Array<{ name: string }>

if (!userColumns.some((column) => column.name === 'seerr_cookie')) {
  this.database.exec(`alter table users add column seerr_cookie text`)
}
```

Methoden:
```ts
saveSeerrCookie(userId: string, cookie: string) {
  this.database
    .prepare('update users set seerr_cookie = ? where id = ?')
    .run(encryptText(cookie, this.secret), userId)
}

getSeerrCookie(userId: string): string | undefined {
  const row = this.database
    .prepare('select seerr_cookie from users where id = ?')
    .get(userId) as { seerr_cookie: string | null } | undefined

  if (!row?.seerr_cookie) {
    return undefined
  }

  return decryptText(row.seerr_cookie, this.secret)
}

clearSeerrCookie(userId: string) {
  this.database.prepare('update users set seerr_cookie = null where id = ?').run(userId)
}

deleteSessionsForUser(userId: string) {
  this.database.prepare('delete from sessions where user_id = ?').run(userId)
}
```

- [ ] **Step 3: Grün + Commit**

Run: `pnpm --filter @lolarr/api test` → PASS.

```bash
git add apps/api
git commit -m "feat: persist encrypted seerr session cookie per user"
```

---

### Task 11: Jellyfin-Adapter — Header, DeviceId, Quick Connect

**Files:**
- Modify: `apps/api/src/adapters/jellyfin.ts` (komplett ersetzen)
- Modify: `apps/api/src/modules/auth.ts` (Aufruf anpassen)
- Test: `apps/api/tests/jellyfin-adapter.test.ts`

**Interfaces:**
- Produces:
  - `buildAuthorizationHeader(deviceId: string, token?: string): string`
  - `authenticateByName(config, input: { username; password; deviceId }): Promise<JellyfinAuthResult>` — 401 → `InvalidCredentialsError`, sonst `UpstreamError`
  - `initiateQuickConnect(config, deviceId): Promise<{ code: string; secret: string }>`
  - `getQuickConnectState(config, secret, deviceId): Promise<{ authenticated: boolean }>`
  - `authenticateWithQuickConnect(config, secret, deviceId): Promise<JellyfinAuthResult>`
  - `authorizeQuickConnect(config, code, userAccessToken, deviceId): Promise<void>` — 401/403 → `JellyfinTokenInvalidError` (userId muss der Aufrufer kennen; Fehler wird dort mit userId neu geworfen — Signatur bleibt schlank: wirft `InvalidCredentialsError`; der Seerr-Service übersetzt, s. Task 12)
  - `JellyfinAuthResult = { user: { id: string; name: string }; accessToken: string }` (unverändert)

- [ ] **Step 1: Failing Test**

`apps/api/tests/jellyfin-adapter.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  authenticateByName,
  authorizeQuickConnect,
  buildAuthorizationHeader,
  getQuickConnectState,
  initiateQuickConnect,
} from '../src/adapters/jellyfin.js'
import { InvalidCredentialsError, UpstreamError } from '../src/lib/errors.js'
import { createTestContext, jellyfinAuthResponse } from './helpers.js'

describe('jellyfin adapter', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('builds the MediaBrowser authorization header', () => {
    expect(buildAuthorizationHeader('device-1')).toBe(
      'MediaBrowser Client="Lolarr", Device="Lolarr Gateway", DeviceId="device-1", Version="0.1.0"',
    )
    expect(buildAuthorizationHeader('device-1', 'tok')).toContain(', Token="tok"')
  })

  it('authenticates by name and sends the device id', async () => {
    let seenAuthHeader = ''
    ctx.jellyfin
      .intercept({
        path: '/Users/AuthenticateByName',
        method: 'POST',
        headers: (headers) => {
          seenAuthHeader = headers.authorization ?? ''
          return true
        },
      })
      .reply(200, jellyfinAuthResponse(), { headers: { 'content-type': 'application/json' } })

    const result = await authenticateByName(ctx.config, {
      username: 'joel',
      password: 'pw',
      deviceId: 'device-1',
    })
    expect(result.accessToken).toBe('jf-access-token')
    expect(result.user).toEqual({ id: 'jf-user-1', name: 'Joel' })
    expect(seenAuthHeader).toContain('DeviceId="device-1"')
    expect(seenAuthHeader).not.toContain('X-Emby')
  })

  it('throws InvalidCredentialsError on 401', async () => {
    ctx.jellyfin
      .intercept({ path: '/Users/AuthenticateByName', method: 'POST' })
      .reply(401, {})
    await expect(
      authenticateByName(ctx.config, { username: 'j', password: 'x', deviceId: 'd' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it('throws UpstreamError on 500', async () => {
    ctx.jellyfin
      .intercept({ path: '/Users/AuthenticateByName', method: 'POST' })
      .reply(500, {})
    await expect(
      authenticateByName(ctx.config, { username: 'j', password: 'x', deviceId: 'd' }),
    ).rejects.toBeInstanceOf(UpstreamError)
  })

  it('runs the quick connect flow', async () => {
    ctx.jellyfin
      .intercept({ path: '/QuickConnect/Initiate', method: 'POST' })
      .reply(200, { Code: '123456', Secret: 'qc-secret' }, { headers: { 'content-type': 'application/json' } })
    ctx.jellyfin
      .intercept({ path: '/QuickConnect/Connect', method: 'GET', query: { secret: 'qc-secret' } })
      .reply(200, { Authenticated: true }, { headers: { 'content-type': 'application/json' } })

    const { code, secret } = await initiateQuickConnect(ctx.config, 'device-1')
    expect(code).toBe('123456')
    const state = await getQuickConnectState(ctx.config, secret, 'device-1')
    expect(state.authenticated).toBe(true)
  })

  it('authorizes a quick connect code with a user token', async () => {
    ctx.jellyfin
      .intercept({ path: '/QuickConnect/Authorize', method: 'POST', query: { code: '123456' } })
      .reply(200, 'true')
    await expect(
      authorizeQuickConnect(ctx.config, '123456', 'user-token', 'device-1'),
    ).resolves.toBeUndefined()
  })
})
```

Run → FAIL (Exporte existieren nicht).

- [ ] **Step 2: Adapter neu schreiben**

`apps/api/src/adapters/jellyfin.ts` (kompletter Inhalt):
```ts
import type { AppConfig } from '../config.js'
import { InvalidCredentialsError, UpstreamError } from '../lib/errors.js'

export type JellyfinAuthResult = {
  user: { id: string; name: string }
  accessToken: string
}

const CLIENT = 'Lolarr'
const DEVICE = 'Lolarr Gateway'
const VERSION = '0.1.0'

export function buildAuthorizationHeader(deviceId: string, token?: string) {
  const base = `MediaBrowser Client="${CLIENT}", Device="${DEVICE}", DeviceId="${deviceId}", Version="${VERSION}"`
  return token ? `${base}, Token="${token}"` : base
}

export async function authenticateByName(
  config: AppConfig,
  input: { username: string; password: string; deviceId: string },
): Promise<JellyfinAuthResult> {
  const response = await jellyfinFetch(config, '/Users/AuthenticateByName', {
    method: 'POST',
    deviceId: input.deviceId,
    body: { Username: input.username, Pw: input.password },
  })

  if (response.status === 401) {
    throw new InvalidCredentialsError()
  }
  assertOk(response, 'Jellyfin login failed')

  return parseAuthResult(await response.json())
}

export async function initiateQuickConnect(config: AppConfig, deviceId: string) {
  const response = await jellyfinFetch(config, '/QuickConnect/Initiate', {
    method: 'POST',
    deviceId,
  })
  assertOk(response, 'Quick Connect initiate failed')

  const payload = (await response.json()) as { Code?: string; Secret?: string }
  if (!payload.Code || !payload.Secret) {
    throw new UpstreamError('jellyfin', response.status, 'Quick Connect response incomplete')
  }
  return { code: payload.Code, secret: payload.Secret }
}

export async function getQuickConnectState(
  config: AppConfig,
  secret: string,
  deviceId: string,
) {
  const response = await jellyfinFetch(
    config,
    `/QuickConnect/Connect?secret=${encodeURIComponent(secret)}`,
    { method: 'GET', deviceId },
  )
  assertOk(response, 'Quick Connect state failed')

  const payload = (await response.json()) as { Authenticated?: boolean }
  return { authenticated: payload.Authenticated === true }
}

export async function authenticateWithQuickConnect(
  config: AppConfig,
  secret: string,
  deviceId: string,
): Promise<JellyfinAuthResult> {
  const response = await jellyfinFetch(config, '/Users/AuthenticateWithQuickConnect', {
    method: 'POST',
    deviceId,
    body: { Secret: secret },
  })
  assertOk(response, 'Quick Connect authentication failed')

  return parseAuthResult(await response.json())
}

export async function authorizeQuickConnect(
  config: AppConfig,
  code: string,
  userAccessToken: string,
  deviceId: string,
): Promise<void> {
  const response = await jellyfinFetch(
    config,
    `/QuickConnect/Authorize?code=${encodeURIComponent(code)}`,
    { method: 'POST', deviceId, token: userAccessToken },
  )

  if (response.status === 401 || response.status === 403) {
    throw new InvalidCredentialsError()
  }
  assertOk(response, 'Quick Connect authorize failed')
}

async function jellyfinFetch(
  config: AppConfig,
  path: string,
  options: { method: string; deviceId: string; token?: string; body?: unknown },
) {
  const headers: Record<string, string> = {
    Authorization: buildAuthorizationHeader(options.deviceId, options.token),
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  try {
    return await fetch(`${config.JELLYFIN_URL}${path}`, {
      method: options.method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch (error) {
    throw new UpstreamError('jellyfin', undefined, `Jellyfin unreachable: ${String(error)}`)
  }
}

function assertOk(response: Response, message: string) {
  if (!response.ok) {
    throw new UpstreamError('jellyfin', response.status, message)
  }
}

function parseAuthResult(payload: unknown): JellyfinAuthResult {
  const data = payload as { AccessToken?: string; User?: { Id?: string; Name?: string } }
  if (!data.AccessToken || !data.User?.Id || !data.User.Name) {
    throw new UpstreamError('jellyfin', undefined, 'Jellyfin auth response incomplete')
  }
  return {
    user: { id: data.User.Id, name: data.User.Name },
    accessToken: data.AccessToken,
  }
}
```

In `apps/api/src/modules/auth.ts`: `authenticateWithJellyfin(config, username, password)` → `authenticateByName(config, { username, password, deviceId: 'lolarr-gateway' })` (echte deviceId kommt in Task 13).

- [ ] **Step 3: Grün + Commit**

Run: `pnpm --filter @lolarr/api test` → PASS.

```bash
git add apps/api
git commit -m "feat: jellyfin adapter with device ids and quick connect support"
```

---

### Task 12: Seerr-Session-Service (Passwort-Login + Silent-QC + Retry)

**Files:**
- Create: `apps/api/src/services/seerrSession.ts`
- Test: `apps/api/tests/seerr-session.test.ts`

**Interfaces:**
- Consumes: `LolarrDatabase.getJellyfinToken/getSeerrCookie/saveSeerrCookie/clearSeerrCookie` (Task 10), `authorizeQuickConnect` (Task 11), Error-Klassen (Task 4).
- Produces: `class SeerrSessionService`:
  - `constructor(config: AppConfig, database: LolarrDatabase)`
  - `loginWithPassword(userId: string, username: string, password: string): Promise<void>` — wirft `UpstreamError` bei Fehlschlag (Aufrufer toleriert)
  - `ensureSession(userId: string): Promise<string>` — Cookie aus Memory→DB→Silent-QC; wirft `JellyfinTokenInvalidError(userId)`, wenn das Jellyfin-Token nicht mehr autorisiert
  - `fetchWithSession(userId: string, path: string, init?: { method?: string; body?: unknown }): Promise<unknown>` — JSON-Antwort; bei Seerr-401 genau 1× Cookie erneuern + retry
  - Interner Memory-Cache `Map<string, string>` vor der DB.

Silent-QC-Ablauf (Spec §Phase 2): Seerr `POST /api/v1/auth/jellyfin/quickconnect/initiate` → `{ code, secret }`; Jellyfin `POST /QuickConnect/Authorize?code=…` mit gespeichertem User-Token (DeviceId: `lolarr-gateway`); Seerr `POST /api/v1/auth/jellyfin/quickconnect/authenticate` (Body `{ secret }`) → `connect.sid` aus `set-cookie`.

- [ ] **Step 1: Failing Test**

`apps/api/tests/seerr-session.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { JellyfinTokenInvalidError } from '../src/lib/errors.js'
import { LolarrDatabase } from '../src/services/database.js'
import { SeerrSessionService } from '../src/services/seerrSession.js'
import { createTestContext } from './helpers.js'

const user = { id: 'user-1', name: 'Joel' }
const SID = 'connect.sid=s%3Afresh; Path=/; HttpOnly'

function mockSilentQuickConnect(ctx: ReturnType<typeof createTestContext>) {
  ctx.seerr
    .intercept({ path: '/api/v1/auth/jellyfin/quickconnect/initiate', method: 'POST' })
    .reply(200, { code: '654321', secret: 'seerr-qc-secret' }, { headers: { 'content-type': 'application/json' } })
  ctx.jellyfin
    .intercept({ path: '/QuickConnect/Authorize', method: 'POST', query: { code: '654321' } })
    .reply(200, 'true')
  ctx.seerr
    .intercept({ path: '/api/v1/auth/jellyfin/quickconnect/authenticate', method: 'POST' })
    .reply(200, { id: 1 }, { headers: { 'set-cookie': SID, 'content-type': 'application/json' } })
}

describe('SeerrSessionService', () => {
  let ctx: ReturnType<typeof createTestContext>
  let db: LolarrDatabase
  let service: SeerrSessionService

  beforeEach(() => {
    ctx = createTestContext()
    db = new LolarrDatabase(ctx.config.LOLARR_DATABASE_PATH, ctx.config.LOLARR_SECRET)
    db.upsertUser(user, 'jf-user-token')
    service = new SeerrSessionService(ctx.config, db)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('stores the cookie from a password login', async () => {
    ctx.seerr
      .intercept({ path: '/api/v1/auth/jellyfin', method: 'POST' })
      .reply(200, { id: 1 }, { headers: { 'set-cookie': SID, 'content-type': 'application/json' } })

    await service.loginWithPassword(user.id, 'joel', 'pw')
    expect(db.getSeerrCookie(user.id)).toBe('connect.sid=s%3Afresh')
  })

  it('acquires a session via silent quick connect when none exists', async () => {
    mockSilentQuickConnect(ctx)
    const cookie = await service.ensureSession(user.id)
    expect(cookie).toBe('connect.sid=s%3Afresh')
    expect(db.getSeerrCookie(user.id)).toBe('connect.sid=s%3Afresh')
  })

  it('renews the cookie once when seerr answers 401', async () => {
    db.saveSeerrCookie(user.id, 'connect.sid=s%3Astale')
    ctx.seerr
      .intercept({ path: '/api/v1/request', method: 'GET' })
      .reply(401, {})
    mockSilentQuickConnect(ctx)
    ctx.seerr
      .intercept({ path: '/api/v1/request', method: 'GET' })
      .reply(200, { results: [] }, { headers: { 'content-type': 'application/json' } })

    const result = await service.fetchWithSession(user.id, '/api/v1/request')
    expect(result).toEqual({ results: [] })
  })

  it('maps a rejected jellyfin token to JellyfinTokenInvalidError', async () => {
    ctx.seerr
      .intercept({ path: '/api/v1/auth/jellyfin/quickconnect/initiate', method: 'POST' })
      .reply(200, { code: '654321', secret: 'seerr-qc-secret' }, { headers: { 'content-type': 'application/json' } })
    ctx.jellyfin
      .intercept({ path: '/QuickConnect/Authorize', method: 'POST', query: { code: '654321' } })
      .reply(401, {})

    await expect(service.ensureSession(user.id)).rejects.toBeInstanceOf(JellyfinTokenInvalidError)
  })
})
```

Run → FAIL (Datei existiert nicht).

- [ ] **Step 2: Implementieren**

`apps/api/src/services/seerrSession.ts`:
```ts
import type { AppConfig } from '../config.js'
import { authorizeQuickConnect } from '../adapters/jellyfin.js'
import {
  InvalidCredentialsError,
  JellyfinTokenInvalidError,
  UpstreamError,
} from '../lib/errors.js'
import type { LolarrDatabase } from './database.js'

const GATEWAY_DEVICE_ID = 'lolarr-gateway'

export class SeerrSessionService {
  private readonly cookies = new Map<string, string>()

  constructor(
    private readonly config: AppConfig,
    private readonly database: LolarrDatabase,
  ) {}

  async loginWithPassword(userId: string, username: string, password: string) {
    const response = await this.seerrFetch('/api/v1/auth/jellyfin', {
      method: 'POST',
      body: { username, password },
    })
    assertOk(response, 'Seerr jellyfin login failed')
    this.storeCookie(userId, extractSessionCookie(response))
  }

  async ensureSession(userId: string): Promise<string> {
    const cached = this.cookies.get(userId) ?? this.database.getSeerrCookie(userId)
    if (cached) {
      this.cookies.set(userId, cached)
      return cached
    }
    return this.silentQuickConnect(userId)
  }

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

    assertOk(response, `Seerr request failed: ${path}`)
    return response.json()
  }

  private async silentQuickConnect(userId: string): Promise<string> {
    const jellyfinToken = this.database.getJellyfinToken(userId)
    if (!jellyfinToken) {
      throw new JellyfinTokenInvalidError(userId)
    }

    const initiate = await this.seerrFetch('/api/v1/auth/jellyfin/quickconnect/initiate', {
      method: 'POST',
    })
    assertOk(initiate, 'Seerr quick connect initiate failed')
    const { code, secret } = (await initiate.json()) as { code?: string; secret?: string }
    if (!code || !secret) {
      throw new UpstreamError('seerr', initiate.status, 'Seerr quick connect response incomplete')
    }

    try {
      await authorizeQuickConnect(this.config, code, jellyfinToken, GATEWAY_DEVICE_ID)
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw new JellyfinTokenInvalidError(userId)
      }
      throw error
    }

    const authenticate = await this.seerrFetch('/api/v1/auth/jellyfin/quickconnect/authenticate', {
      method: 'POST',
      body: { secret },
    })
    assertOk(authenticate, 'Seerr quick connect authenticate failed')

    const cookie = extractSessionCookie(authenticate)
    this.storeCookie(userId, cookie)
    return cookie
  }

  private storeCookie(userId: string, cookie: string) {
    this.cookies.set(userId, cookie)
    this.database.saveSeerrCookie(userId, cookie)
  }

  private async seerrFetch(
    path: string,
    options: { method?: string; body?: unknown; cookie?: string } = {},
  ) {
    const headers: Record<string, string> = {}
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }
    if (options.cookie) {
      headers.Cookie = options.cookie
    }

    try {
      return await fetch(`${this.config.SEERR_URL}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      })
    } catch (error) {
      throw new UpstreamError('seerr', undefined, `Seerr unreachable: ${String(error)}`)
    }
  }
}

function assertOk(response: Response, message: string) {
  if (!response.ok) {
    throw new UpstreamError('seerr', response.status, message)
  }
}

function extractSessionCookie(response: Response): string {
  const setCookies = response.headers.getSetCookie()
  const sid = setCookies.find((value) => value.startsWith('connect.sid='))
  if (!sid) {
    throw new UpstreamError('seerr', response.status, 'Seerr login returned no session cookie')
  }
  return sid.split(';')[0] ?? sid
}
```

- [ ] **Step 3: Grün + Commit**

Run: `pnpm --filter @lolarr/api test` → PASS.

```bash
git add apps/api
git commit -m "feat: seerr session service with password login and silent quick connect"
```

---

### Task 13: Login-Route — deviceId, Seerr-Kopplung, erweiterte Response

**Files:**
- Modify: `packages/domain/src/index.ts` (`loginRequestSchema`, `loginResponseSchema`)
- Modify: `apps/api/src/lib/context.ts` (+`seerrSession`)
- Modify: `apps/api/src/server.ts` (Service instanziieren)
- Modify: `apps/api/src/modules/auth.ts`
- Modify: `packages/features/src/auth/useAuth.ts` (deviceId + jellyfin-Block speichern)
- Test: `apps/api/tests/login.test.ts`

**Interfaces:**
- Produces (domain):
```ts
export const loginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  deviceId: z.string().min(8),
})

export const jellyfinSessionSchema = z.object({
  url: z.string(),
  accessToken: z.string(),
  userId: z.string(),
  deviceId: z.string(),
})
export type JellyfinSession = z.infer<typeof jellyfinSessionSchema>

export const loginResponseSchema = z.object({
  token: z.string(),
  user: userSchema,
  jellyfin: jellyfinSessionSchema,
})
```
- Client speichert `jellyfin`-Block unter Storage-Key `lolarr.jellyfin` (JSON) — Konsument kommt in Slice 2.

- [ ] **Step 1: Failing Test**

`apps/api/tests/login.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../src/server.js'
import { createTestContext, jellyfinAuthResponse } from './helpers.js'

const loginPayload = { username: 'joel', password: 'pw', deviceId: 'web-device-1' }

describe('POST /api/auth/login', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
    ctx.jellyfin
      .intercept({ path: '/Users/AuthenticateByName', method: 'POST' })
      .reply(200, jellyfinAuthResponse(), { headers: { 'content-type': 'application/json' } })
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('returns session token plus jellyfin connection details', async () => {
    ctx.seerr
      .intercept({ path: '/api/v1/auth/jellyfin', method: 'POST' })
      .reply(200, { id: 1 }, { headers: { 'set-cookie': 'connect.sid=s%3Aabc; Path=/' } })

    const app = createServer(ctx.config)
    const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: loginPayload })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.token).toMatch(/^lolarr_/)
    expect(body.jellyfin).toEqual({
      url: ctx.config.JELLYFIN_URL,
      accessToken: 'jf-access-token',
      userId: 'jf-user-1',
      deviceId: 'web-device-1',
    })
  })

  it('still succeeds when seerr is down', async () => {
    ctx.seerr
      .intercept({ path: '/api/v1/auth/jellyfin', method: 'POST' })
      .reply(503, {})

    const app = createServer(ctx.config)
    const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: loginPayload })
    expect(response.statusCode).toBe(200)
  })

  it('rejects logins without a device id', async () => {
    const app = createServer(ctx.config)
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'joel', password: 'pw' },
    })
    expect(response.statusCode).toBe(400)
  })
})
```

Run → FAIL.

- [ ] **Step 2: Implementieren**

Domain-Schemas wie oben ersetzen. `lib/context.ts`: `seerrSession: SeerrSessionService` ergänzen; in `server.ts` instanziieren (`new SeerrSessionService(config, database)` — Database-Instanz vorher erzeugen und beiden geben).

`modules/auth.ts`, Login-Handler:
```ts
app.post('/api/auth/login', async (request) => {
  const credentials = loginRequestSchema.parse(request.body)

  const auth = await authenticateByName(config, credentials)
  database.upsertUser(auth.user, auth.accessToken)

  try {
    await seerrSession.loginWithPassword(auth.user.id, credentials.username, credentials.password)
  } catch (error) {
    request.log.warn({ err: error }, 'seerr login failed — will retry via silent quick connect')
  }

  const session = database.createSession(auth.user)
  return {
    ...session,
    jellyfin: {
      url: config.JELLYFIN_URL,
      accessToken: auth.accessToken,
      userId: auth.user.id,
      deviceId: credentials.deviceId,
    },
  }
})
```

`packages/features/src/auth/useAuth.ts`: Login-Payload um `deviceId: getOrCreateDeviceId(storage)` ergänzen; in `onSuccess` zusätzlich `storage.set('lolarr.jellyfin', JSON.stringify(response.jellyfin))`; `signOut` entfernt den Key.

- [ ] **Step 3: Grün + Commit**

Run: `pnpm --filter @lolarr/api test && pnpm typecheck` → PASS.

```bash
git add apps/api packages/domain packages/features
git commit -m "feat: login couples seerr session and returns jellyfin connection details"
```

---

### Task 14: Quick-Connect-Routen im BFF

**Files:**
- Modify: `packages/domain/src/index.ts` (QC-Schemas)
- Modify: `apps/api/src/modules/auth.ts`
- Test: `apps/api/tests/quickconnect.test.ts`

**Interfaces:**
- Produces (domain):
```ts
export const qcInitiateRequestSchema = z.object({ deviceId: z.string().min(8) })
export const qcInitiateResponseSchema = z.object({ code: z.string(), pollToken: z.string() })
export type QcInitiateResponse = z.infer<typeof qcInitiateResponseSchema>

export const qcStateResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('pending') }),
  loginResponseSchema.extend({ status: z.literal('authenticated') }),
])
export type QcStateResponse = z.infer<typeof qcStateResponseSchema>
```
- Routen: `POST /api/auth/qc/initiate` (Body `{ deviceId }`), `GET /api/auth/qc/state?pollToken=…`. Das Jellyfin-QC-Secret bleibt serverseitig (in-memory `Map<pollToken, { secret, deviceId, createdAt }>`, TTL 10 min, Prune bei jedem Zugriff). Nach erfolgreichem `authenticated`: Seerr-Session via `seerrSession.ensureSession(userId)` (Silent-QC), Fehler wird nur geloggt (Login darf nicht scheitern).

- [ ] **Step 1: Failing Test**

`apps/api/tests/quickconnect.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../src/server.js'
import { createTestContext, jellyfinAuthResponse } from './helpers.js'

describe('quick connect login', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('initiates, polls pending, then authenticates', async () => {
    ctx.jellyfin
      .intercept({ path: '/QuickConnect/Initiate', method: 'POST' })
      .reply(200, { Code: '123456', Secret: 'jf-qc-secret' }, { headers: { 'content-type': 'application/json' } })
    ctx.jellyfin
      .intercept({ path: '/QuickConnect/Connect', method: 'GET', query: { secret: 'jf-qc-secret' } })
      .reply(200, { Authenticated: false }, { headers: { 'content-type': 'application/json' } })

    const app = createServer(ctx.config)

    const initiate = await app.inject({
      method: 'POST',
      url: '/api/auth/qc/initiate',
      payload: { deviceId: 'tv-device-1' },
    })
    expect(initiate.statusCode).toBe(200)
    const { code, pollToken } = initiate.json()
    expect(code).toBe('123456')
    expect(pollToken).not.toBe('jf-qc-secret')

    const pending = await app.inject({ method: 'GET', url: `/api/auth/qc/state?pollToken=${pollToken}` })
    expect(pending.json()).toEqual({ status: 'pending' })

    ctx.jellyfin
      .intercept({ path: '/QuickConnect/Connect', method: 'GET', query: { secret: 'jf-qc-secret' } })
      .reply(200, { Authenticated: true }, { headers: { 'content-type': 'application/json' } })
    ctx.jellyfin
      .intercept({ path: '/Users/AuthenticateWithQuickConnect', method: 'POST' })
      .reply(200, jellyfinAuthResponse(), { headers: { 'content-type': 'application/json' } })
    // Seerr-Silent-QC schlägt fehl → Login muss trotzdem gelingen
    ctx.seerr
      .intercept({ path: '/api/v1/auth/jellyfin/quickconnect/initiate', method: 'POST' })
      .reply(503, {})

    const done = await app.inject({ method: 'GET', url: `/api/auth/qc/state?pollToken=${pollToken}` })
    const body = done.json()
    expect(body.status).toBe('authenticated')
    expect(body.token).toMatch(/^lolarr_/)
    expect(body.jellyfin.deviceId).toBe('tv-device-1')
  })

  it('rejects unknown poll tokens', async () => {
    const app = createServer(ctx.config)
    const response = await app.inject({ method: 'GET', url: '/api/auth/qc/state?pollToken=nope' })
    expect(response.statusCode).toBe(404)
  })
})
```

Run → FAIL.

- [ ] **Step 2: Implementieren** — in `modules/auth.ts`:

```ts
import { randomUUID } from 'node:crypto'

type PendingQuickConnect = { secret: string; deviceId: string; createdAt: number }
const QC_TTL_MS = 10 * 60 * 1000

export async function authRoutes(app: FastifyInstance, context: AppContext) {
  const { config, database, seerrSession } = context
  const pendingQuickConnects = new Map<string, PendingQuickConnect>()

  // … bestehende Routen (login, session/me) …

  app.post('/api/auth/qc/initiate', async (request) => {
    const { deviceId } = qcInitiateRequestSchema.parse(request.body)
    const { code, secret } = await initiateQuickConnect(config, deviceId)
    const pollToken = randomUUID()
    pendingQuickConnects.set(pollToken, { secret, deviceId, createdAt: Date.now() })
    return { code, pollToken }
  })

  app.get('/api/auth/qc/state', async (request, reply) => {
    prune(pendingQuickConnects)
    const pollToken = readPollToken(request.query)
    const pending = pollToken ? pendingQuickConnects.get(pollToken) : undefined

    if (!pollToken || !pending) {
      return reply.code(404).send({ error: 'Unknown or expired poll token' })
    }

    const state = await getQuickConnectState(config, pending.secret, pending.deviceId)
    if (!state.authenticated) {
      return { status: 'pending' }
    }

    pendingQuickConnects.delete(pollToken)
    const auth = await authenticateWithQuickConnect(config, pending.secret, pending.deviceId)
    database.upsertUser(auth.user, auth.accessToken)

    try {
      await seerrSession.ensureSession(auth.user.id)
    } catch (error) {
      request.log.warn({ err: error }, 'seerr silent quick connect failed during login')
    }

    const session = database.createSession(auth.user)
    return {
      status: 'authenticated',
      ...session,
      jellyfin: {
        url: config.JELLYFIN_URL,
        accessToken: auth.accessToken,
        userId: auth.user.id,
        deviceId: pending.deviceId,
      },
    }
  })
}

function prune(map: Map<string, PendingQuickConnect>) {
  const cutoff = Date.now() - QC_TTL_MS
  for (const [key, value] of map) {
    if (value.createdAt < cutoff) {
      map.delete(key)
    }
  }
}

function readPollToken(query: unknown): string | undefined {
  if (typeof query === 'object' && query !== null && 'pollToken' in query) {
    const value = (query as { pollToken: unknown }).pollToken
    return typeof value === 'string' && value.length > 0 ? value : undefined
  }
  return undefined
}
```
Domain-Schemas (siehe Interfaces) in `packages/domain/src/index.ts` ergänzen.

- [ ] **Step 3: Grün + Commit**

Run: `pnpm --filter @lolarr/api test` → PASS.

```bash
git add apps/api packages/domain
git commit -m "feat: quick connect login endpoints with server-held secrets"
```

---

### Task 15: Client — Quick-Connect-Login-Screen (TV) 

**Files:**
- Modify: `packages/api-client/src/index.ts` (+`qcInitiate`, `qcState`)
- Create: `packages/ui/src/components/QuickConnectPanel.tsx`
- Modify: `packages/ui/src/index.ts`
- Create: `packages/features/src/auth/QuickConnectScreen.tsx`
- Modify: `packages/features/src/auth/LoginScreen.tsx` (Umschalt-Action)
- Modify: `packages/features/src/app.tsx` (Screen einhängen)

**Interfaces:**
- Consumes: `QcInitiateResponse`, `QcStateResponse` (Task 14), `useAuth` (Task 8/13).
- Produces (api-client):
```ts
qcInitiate(payload: { deviceId: string }) {
  return request<QcInitiateResponse>('/api/auth/qc/initiate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
},
qcState(pollToken: string) {
  const searchParams = new URLSearchParams({ pollToken })
  return request<QcStateResponse>(`/api/auth/qc/state?${searchParams}`)
},
```

- [ ] **Step 1: api-client erweitern** (Code oben; Typen aus `@lolarr/domain` importieren).

- [ ] **Step 2: QuickConnectPanel**

`packages/ui/src/components/QuickConnectPanel.tsx`:
```tsx
import type { ActionComponent } from './types'

type QuickConnectPanelProps = {
  Action: ActionComponent
  code?: string
  error?: string
  onCancel: () => void
}

export function QuickConnectPanel({ Action, code, error, onCancel }: QuickConnectPanelProps) {
  return (
    <section className="panel quick-connect-panel">
      <h2>Quick Connect</h2>
      {error ? <p className="error-text">{error}</p> : null}
      {code ? (
        <>
          <p>Open the Jellyfin app on your phone and enter this code:</p>
          <p className="quick-connect-code">{code}</p>
          <p>Waiting for approval…</p>
        </>
      ) : (
        <p>Requesting code…</p>
      )}
      <Action onPress={onCancel} focusKey="qc-cancel">
        Back to password login
      </Action>
    </section>
  )
}
```
Export in `packages/ui/src/index.ts` ergänzen. Styles: `.quick-connect-code { font-size: 3rem; letter-spacing: 0.3em; }` in `packages/ui/src/styles.css` anhängen.

- [ ] **Step 3: QuickConnectScreen**

`packages/features/src/auth/QuickConnectScreen.tsx`:
```tsx
import { useQuery } from '@tanstack/react-query'
import { QuickConnectPanel, type ActionComponent } from '@lolarr/ui'
import { useApi } from '../api.js'
import { readErrorMessage } from '../lib/errors.js'

type QuickConnectScreenProps = {
  Action: ActionComponent
  deviceId: string
  onAuthenticated: (response: {
    token: string
    user: { id: string; name: string }
    jellyfin: { url: string; accessToken: string; userId: string; deviceId: string }
  }) => void
  onCancel: () => void
}

export function QuickConnectScreen({
  Action,
  deviceId,
  onAuthenticated,
  onCancel,
}: QuickConnectScreenProps) {
  const api = useApi()

  const initiateQuery = useQuery({
    queryKey: ['qc-initiate', deviceId],
    queryFn: () => api.qcInitiate({ deviceId }),
    staleTime: Infinity,
    retry: false,
  })

  const pollToken = initiateQuery.data?.pollToken

  useQuery({
    queryKey: ['qc-state', pollToken],
    enabled: Boolean(pollToken),
    refetchInterval: 5000,
    retry: false,
    queryFn: async () => {
      const state = await api.qcState(pollToken as string)
      if (state.status === 'authenticated') {
        onAuthenticated(state)
      }
      return state
    },
  })

  const error = initiateQuery.error ? readErrorMessage(initiateQuery.error) : undefined

  return (
    <QuickConnectPanel
      Action={Action}
      code={initiateQuery.data?.code}
      error={error}
      onCancel={onCancel}
    />
  )
}
```

- [ ] **Step 4: Verdrahten**

`LoginScreen.tsx`: unter dem Formular `Action` „Sign in with Quick Connect" → Callback `onQuickConnect`. In `app.tsx`: lokaler State `loginMode: 'password' | 'quickconnect'` im Auth-Zweig; `onAuthenticated` schreibt Token + `lolarr.jellyfin` über dieselbe Logik wie der Passwort-Login (in `useAuth` als `adoptSession(response)`-Funktion exportieren: setzt Token-State, Storage-Keys, Query-Cache).

- [ ] **Step 5: Verifizieren**

Run: `pnpm typecheck && pnpm --filter @lolarr/tv build`
Expected: grün. Manuell (sofern Jellyfin-Instanz mit QC verfügbar): `pnpm dev:web`, „Sign in with Quick Connect" → Code erscheint, Freigabe in Jellyfin-App → Home-Screen.

- [ ] **Step 6: Commit**

```bash
git add packages/api-client packages/ui packages/features
git commit -m "feat: quick connect login screen"
```

---

### Task 16: Betreiber-Doku + Seerr-Proxy für Requests

**Files:**
- Modify: `apps/api/src/adapters/seerr.ts` (`requestMedia` über User-Session)
- Modify: `apps/api/src/modules/requests.ts`
- Modify: `README.md`, `.env.example`
- Test: `apps/api/tests/requests-seerr-session.test.ts`

**Interfaces:**
- Consumes: `SeerrSessionService.fetchWithSession` (Task 12).
- Produces: `SeerrAdapter.requestMedia(userId: string, mediaType, tmdbId)` — läuft über die User-Session statt Admin-Key (Spec: Requests mit User-Kontext; Discover/Search bleiben beim Admin-Key). Konstruktor: `new SeerrAdapter(config, seerrSession)`.

- [ ] **Step 1: Failing Test**

`apps/api/tests/requests-seerr-session.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../src/server.js'
import { createTestContext, jellyfinAuthResponse } from './helpers.js'

describe('POST /api/requests uses the user seerr session', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('sends the request with the user cookie, not the api key', async () => {
    ctx.jellyfin
      .intercept({ path: '/Users/AuthenticateByName', method: 'POST' })
      .reply(200, jellyfinAuthResponse(), { headers: { 'content-type': 'application/json' } })
    ctx.seerr
      .intercept({ path: '/api/v1/auth/jellyfin', method: 'POST' })
      .reply(200, { id: 1 }, { headers: { 'set-cookie': 'connect.sid=s%3Auser; Path=/' } })

    let seenCookie = ''
    let seenApiKey: string | undefined
    ctx.seerr
      .intercept({
        path: '/api/v1/request',
        method: 'POST',
        headers: (headers) => {
          seenCookie = headers.cookie ?? ''
          seenApiKey = headers['x-api-key']
          return true
        },
      })
      .reply(201, { id: 42 }, { headers: { 'content-type': 'application/json' } })

    const app = createServer(ctx.config)
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'joel', password: 'pw', deviceId: 'device-abc' },
    })
    const { token } = login.json()

    const response = await app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: { mediaType: 'movie', tmdbId: 550, title: 'Fight Club' },
    })

    expect(response.statusCode).toBe(200)
    expect(seenCookie).toBe('connect.sid=s%3Auser')
    expect(seenApiKey).toBeUndefined()
  })

  it('ends the lolarr session when the jellyfin token is no longer valid (401 cascade)', async () => {
    ctx.jellyfin
      .intercept({ path: '/Users/AuthenticateByName', method: 'POST' })
      .reply(200, jellyfinAuthResponse(), { headers: { 'content-type': 'application/json' } })
    // Kein Seerr-Login-Intercept → kein Cookie gespeichert; Request erzwingt Silent-QC.
    ctx.seerr
      .intercept({ path: '/api/v1/auth/jellyfin/quickconnect/initiate', method: 'POST' })
      .reply(200, { code: '654321', secret: 'seerr-qc-secret' }, { headers: { 'content-type': 'application/json' } })
    ctx.jellyfin
      .intercept({ path: '/QuickConnect/Authorize', method: 'POST', query: { code: '654321' } })
      .reply(401, {}) // Jellyfin-Token wurde revoked

    const app = createServer(ctx.config)
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'joel', password: 'pw', deviceId: 'device-abc' },
    })
    const { token } = login.json()

    const response = await app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: { mediaType: 'movie', tmdbId: 550, title: 'Fight Club' },
    })
    expect(response.statusCode).toBe(401)
    expect(response.json().error).toBe('session_expired')

    // Session ist serverseitig gelöscht — Folgerequest scheitert bereits am Auth-Hook.
    const followUp = await app.inject({
      method: 'GET',
      url: '/api/requests',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(followUp.statusCode).toBe(401)
  })
})
```

Run → FAIL (Request geht heute mit X-Api-Key raus).

- [ ] **Step 2: Implementieren**

`SeerrAdapter`: Konstruktor `(config: AppConfig, sessions: SeerrSessionService)`. `requestMedia` wird zu:
```ts
async requestMedia(
  userId: string,
  mediaType: MediaType,
  tmdbId: number,
): Promise<{ status: RequestStatus; seerrRequestId?: string }> {
  const payload =
    mediaType === 'movie'
      ? { mediaType, mediaId: tmdbId }
      : { mediaType, mediaId: tmdbId, seasons: 'all' }

  const response = await this.sessions.fetchWithSession(userId, '/api/v1/request', {
    method: 'POST',
    body: payload,
  })

  const requestId = readNumber(response, ['id', 'requestId'])
  return {
    status: 'pending',
    seerrRequestId: requestId ? String(requestId) : undefined,
  }
}
```
`modules/requests.ts`: `seerr.requestMedia(request.session.user.id, payload.mediaType, payload.tmdbId)`. In `server.ts` Instanziierungs-Reihenfolge: database → seerrSession → seerr. Der POST-Handler behält kein eigenes try/catch mehr — `UpstreamError`/`JellyfinTokenInvalidError` behandelt der zentrale Handler (502 bzw. 401). Bei `JellyfinTokenInvalidError` zusätzlich im Error-Handler: `database.deleteSessionsForUser(error.userId)` (Import in `plugins/errors.ts`; Signatur wird `registerErrorHandler(app, database)` — Aufruf in `server.ts` anpassen). Das ist die 401-Kaskade aus der Spec.

- [ ] **Step 3: README + .env.example**

README, neuer Abschnitt „## Requirements":
```markdown
## Requirements

- **Jellyfin** 10.10+ with **Quick Connect enabled** (Dashboard → General)
- **Seerr ≥ v3.4.0** (until released: the `develop`/preview image) with:
  - *Enable Jellyfin Sign-In* turned on
  - *Enable New Jellyfin Sign-In* turned on (users log in without prior import)
- Environment: see `.env.example` — all variables are required; the API refuses to start otherwise.
```
`.env.example`: Kommentarzeile ergänzen `# All variables are required — the API fails fast when one is missing.`

- [ ] **Step 4: Grün — kompletter Durchlauf**

Run: `pnpm --filter @lolarr/api test && pnpm typecheck && pnpm lint`
Expected: alle Tests PASS (inkl. aller früheren Tasks), Typecheck + Lint grün.

- [ ] **Step 5: Commit**

```bash
git add apps/api README.md .env.example
git commit -m "feat: route media requests through per-user seerr sessions, document prerequisites"
```

---

## Abschluss-Checkliste (nach Task 16)

- [ ] `pnpm --filter @lolarr/api test` — alle Tests grün
- [ ] `pnpm typecheck && pnpm lint && pnpm build` — grün
- [ ] Smoke-Test Web: Login mit echten Jellyfin-Credentials → Home mit echten Seerr-Discover-Rows → Titel anfragen → erscheint unter Requests
- [ ] Smoke-Test QC (wenn Instanz verfügbar): Quick-Connect-Code → Freigabe → eingeloggt
- [ ] Spec-Abgleich: alle 7 Testfälle aus Spec §Testing vorhanden (Login happy, Seerr down, QC-Flow, Silent-QC-Renewal, 401-Kaskade, Auth-Hook, Requests-Sichtbarkeit)
