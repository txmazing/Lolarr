# Lolarr Slice 6: Seerr-Webhooks → Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seerr benachrichtigt Lolarr per Webhook über den Anfrage-Lebenszyklus; Lolarr persistiert die Events pro Nutzer und der Client zeigt sie als einmaligen Toast plus Unread-Badge am Requests-Eintrag.

**Architecture:** Öffentliche, Secret-geschützte BFF-Route `POST /api/webhooks/seerr` mappt Seerr-Payloads auf Notification-Zeilen (Raw-SQL, dedupliziert). Der Client pollt `GET /api/notifications` (~45 s), toastet neue Events genau einmal und markiert beim Öffnen des Requests-Screens alles gelesen.

**Tech Stack:** Fastify + `node:sqlite` (BFF), Zod (Domain/Validierung), React + TanStack Query (Client), Vitest + @testing-library/react (Tests), pnpm + moon (Monorepo).

## Global Constraints

- `erasableSyntaxOnly` — **keine** TS-Parameter-Properties; explizite Feld-Deklarationen in Klassen.
- ESM mit `.js`-Import-Suffixen; `verbatimModuleSyntax` → type-only imports als `import type`.
- Conventional Commits, **Englisch**. UI-Texte **Englisch**.
- `react-refresh/only-export-components` — ein Hook neben seinem Provider braucht denselben
  `// eslint-disable-next-line react-refresh/only-export-components`-Kommentar wie `packages/features/src/api.tsx`.
- `noUnusedLocals`/`noUnusedParameters` sind an — keine ungenutzten Imports/Variablen.
- Nutzer-Matching per Username case-insensitiv (`collate nocase`), **kein** Email-Fallback.
- Verifikation nach jedem Task: der Task-spezifische Vitest-Lauf. Gesamt-Gate am Ende:
  `pnpm test && pnpm typecheck && pnpm lint` + `pnpm --filter @lolarr/web build` + `pnpm --filter @lolarr/tv build`.

## File Structure

**BFF (`apps/api`):**
- `src/config.ts` (mod) — `LOLARR_WEBHOOK_SECRET` required.
- `src/adapters/seerrWebhook.ts` (neu) — Zod-Schema + `mapWebhookToNotification` (pure).
- `src/services/database.ts` (mod) — `notifications`-Tabelle + Methoden.
- `src/modules/webhooks.ts` (neu) — `POST /api/webhooks/seerr`.
- `src/modules/notifications.ts` (neu) — `GET /api/notifications`, `POST /api/notifications/read`.
- `src/plugins/auth.ts` (mod) — `/api/webhooks/` in `PUBLIC_PREFIXES`.
- `src/server.ts` (mod) — beide Route-Module registrieren.
- `tests/helpers.ts`, `tests/config.test.ts` (mod) — required env-Var.
- `.env.example`, `README.md` (mod) — Doku.

**Domain (`packages/domain`):** `src/index.ts` (mod) — Notification-Schemas.
**API-Client (`packages/api-client`):** `src/index.ts` (mod) — `notifications()`, `markNotificationsRead()`.
**UI (`packages/ui`):** `src/components/ToastStack.tsx` (neu), `src/styles.css` (mod), `src/index.ts` (mod).
**Features (`packages/features`):** `src/notifications/ToastProvider.tsx` (neu), `src/notifications/NotificationsProvider.tsx` (neu), `src/experience.tsx` (mod), `src/home/HomeScreen.tsx` (mod), `src/requests/RequestsScreen.tsx` (mod).

---

### Task 1: Domain-Schemas + API-Client-Methoden

**Files:**
- Modify: `packages/domain/src/index.ts` (append nach `requestsResponseSchema`)
- Modify: `packages/api-client/src/index.ts`
- Test: `apps/api/tests/domain-schemas.test.ts` (neuer describe-Block)

**Interfaces:**
- Produces: `notificationKindSchema`, `notificationSchema`, `notificationsResponseSchema`;
  Typen `Notification`, `NotificationKind`, `NotificationsResponse`. Client-Methoden
  `notifications(): Promise<NotificationsResponse>`, `markNotificationsRead(): Promise<{ unreadCount: number }>`.

- [ ] **Step 1: Failing test** — an `apps/api/tests/domain-schemas.test.ts` anhängen:

```ts
describe('notification schemas', () => {
  it('parses a valid notification', () => {
    const parsed = notificationSchema.parse({
      id: 'n1',
      kind: 'available',
      tmdbId: 550,
      mediaType: 'movie',
      title: 'Fight Club',
      createdAt: '2026-07-04T10:00:00.000Z',
      read: false,
    })
    expect(parsed.kind).toBe('available')
  })

  it('rejects an unknown kind', () => {
    expect(() =>
      notificationSchema.parse({
        id: 'n1',
        kind: 'archived',
        tmdbId: 550,
        mediaType: 'movie',
        title: 'Fight Club',
        createdAt: '2026-07-04T10:00:00.000Z',
        read: false,
      }),
    ).toThrow()
  })

  it('parses a notifications response with an unread count', () => {
    const parsed = notificationsResponseSchema.parse({ notifications: [], unreadCount: 3 })
    expect(parsed.unreadCount).toBe(3)
  })
})
```

Ergänze den Import oben in der Testdatei um `notificationSchema` und `notificationsResponseSchema`
(die Datei importiert bereits Schemas aus `@lolarr/domain` — nimm sie in dieselbe Import-Liste auf).

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm --filter @lolarr/api exec vitest run tests/domain-schemas.test.ts`
Expected: FAIL — `notificationSchema` ist nicht exportiert.

- [ ] **Step 3: Implement** — in `packages/domain/src/index.ts` nach `requestsResponseSchema`/`RequestsResponse` einfügen:

```ts
export const notificationKindSchema = z.enum(['available', 'approved', 'declined', 'failed'])
export type NotificationKind = z.infer<typeof notificationKindSchema>

export const notificationSchema = z.object({
  id: z.string(),
  kind: notificationKindSchema,
  tmdbId: z.number().int(),
  mediaType: mediaTypeSchema,
  title: z.string(),
  createdAt: z.string(),
  read: z.boolean(),
})
export type Notification = z.infer<typeof notificationSchema>

export const notificationsResponseSchema = z.object({
  notifications: z.array(notificationSchema),
  unreadCount: z.number().int(),
})
export type NotificationsResponse = z.infer<typeof notificationsResponseSchema>
```

Dann in `packages/api-client/src/index.ts`: `NotificationsResponse` in die Typ-Import-Liste
aus `@lolarr/domain` aufnehmen und im zurückgegebenen Objekt (nach `deleteRequest`) ergänzen:

```ts
    notifications() {
      return request<NotificationsResponse>('/api/notifications')
    },
    markNotificationsRead() {
      return request<{ unreadCount: number }>('/api/notifications/read', { method: 'POST' })
    },
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm --filter @lolarr/api exec vitest run tests/domain-schemas.test.ts`
Expected: PASS. Zusätzlich `pnpm --filter @lolarr/api-client exec tsc -p tsconfig.json` (typecheck grün).

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/index.ts packages/api-client/src/index.ts apps/api/tests/domain-schemas.test.ts
git commit -m "feat(domain): add notification schemas and api-client methods"
```

---

### Task 2: DB — notifications-Tabelle + Methoden

**Files:**
- Modify: `apps/api/src/services/database.ts`
- Test: `apps/api/tests/database.test.ts` (neuer describe-Block)

**Interfaces:**
- Consumes: bestehende `LolarrDatabase` (Konstruktor `(path, secret)`), `users`-Tabelle.
- Produces: Typen `NotificationKindRow = 'available'|'approved'|'declined'|'failed'`,
  `NotificationRow = { id, kind, tmdbId, mediaType, title, createdAt, read }`. Methoden
  `insertNotification({ id, userId, kind, tmdbId, mediaType, title }): boolean`,
  `findUserByName(name): { id, name } | undefined`,
  `listNotifications(userId, limit?): NotificationRow[]`,
  `countUnread(userId): number`, `markNotificationsRead(userId): void`.

- [ ] **Step 1: Failing test** — an `apps/api/tests/database.test.ts` anhängen. Am Dateikopf
  prüfen, dass `LolarrDatabase` importiert und ein Temp-DB-Pfad genutzt wird (bestehendes Muster
  der Datei übernehmen). Falls die Datei noch keinen Helper hat, diesen Block verwenden:

```ts
describe('notifications', () => {
  function freshDb() {
    const path = join(tmpdir(), `lolarr-notif-${randomUUID()}.sqlite`)
    const db = new LolarrDatabase(path, 'test-secret-at-least-16-chars')
    db.upsertUser({ id: 'u1', name: 'Joel' }, 'jf-token')
    return { db, path }
  }

  it('inserts and lists a notification, deduping on (user, tmdb, mediaType, kind)', () => {
    const { db } = freshDb()
    expect(
      db.insertNotification({ id: 'n1', userId: 'u1', kind: 'available', tmdbId: 550, mediaType: 'movie', title: 'Fight Club' }),
    ).toBe(true)
    // same key again → no-op, returns false
    expect(
      db.insertNotification({ id: 'n2', userId: 'u1', kind: 'available', tmdbId: 550, mediaType: 'movie', title: 'Fight Club' }),
    ).toBe(false)
    const rows = db.listNotifications('u1')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: 'n1', kind: 'available', tmdbId: 550, mediaType: 'movie', title: 'Fight Club', read: false })
  })

  it('counts unread and marks all read', () => {
    const { db } = freshDb()
    db.insertNotification({ id: 'n1', userId: 'u1', kind: 'available', tmdbId: 1, mediaType: 'movie', title: 'A' })
    db.insertNotification({ id: 'n2', userId: 'u1', kind: 'declined', tmdbId: 2, mediaType: 'movie', title: 'B' })
    expect(db.countUnread('u1')).toBe(2)
    db.markNotificationsRead('u1')
    expect(db.countUnread('u1')).toBe(0)
    expect(db.listNotifications('u1').every((row) => row.read)).toBe(true)
  })

  it('finds a user by name case-insensitively', () => {
    const { db } = freshDb()
    expect(db.findUserByName('joel')?.id).toBe('u1')
    expect(db.findUserByName('JOEL')?.id).toBe('u1')
    expect(db.findUserByName('nobody')).toBeUndefined()
  })
})
```

Stelle sicher, dass `join`, `tmpdir`, `randomUUID` und `LolarrDatabase` in der Testdatei
importiert sind (bestehende Imports der Datei; sonst ergänzen:
`import { randomUUID } from 'node:crypto'`, `import { tmpdir } from 'node:os'`,
`import { join } from 'node:path'`, `import { LolarrDatabase } from '../src/services/database.js'`).

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm --filter @lolarr/api exec vitest run tests/database.test.ts`
Expected: FAIL — `insertNotification` existiert nicht.

- [ ] **Step 3: Implement** — in `apps/api/src/services/database.ts`:

(a) Am Ende von `migrate()` (nach `drop table if exists requests`) den Tabellen-DDL ergänzen:

```ts
    this.database.exec(`
      create table if not exists notifications (
        id text primary key,
        user_id text not null references users(id),
        kind text not null,
        tmdb_id integer not null,
        media_type text not null,
        title text not null,
        created_at text not null default current_timestamp,
        read_at text,
        unique(user_id, tmdb_id, media_type, kind)
      );

      create index if not exists notifications_user_created
        on notifications(user_id, created_at desc);
    `)
```

(b) Oben in der Datei (nach `StoredSession`) die Typen ergänzen:

```ts
export type NotificationKindRow = 'available' | 'approved' | 'declined' | 'failed'

export type NotificationRow = {
  id: string
  kind: NotificationKindRow
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  createdAt: string
  read: boolean
}
```

(c) In der Klasse `LolarrDatabase` (z.B. nach `deleteSessionsForUser`) die Methoden ergänzen:

```ts
  insertNotification(input: {
    id: string
    userId: string
    kind: NotificationKindRow
    tmdbId: number
    mediaType: 'movie' | 'tv'
    title: string
  }): boolean {
    const result = this.database
      .prepare(
        `insert into notifications (id, user_id, kind, tmdb_id, media_type, title)
         values (?, ?, ?, ?, ?, ?)
         on conflict(user_id, tmdb_id, media_type, kind) do nothing`,
      )
      .run(input.id, input.userId, input.kind, input.tmdbId, input.mediaType, input.title)
    return Number(result.changes) > 0
  }

  findUserByName(name: string): { id: string; name: string } | undefined {
    return this.database
      .prepare('select id, name from users where name = ? collate nocase')
      .get(name) as { id: string; name: string } | undefined
  }

  listNotifications(userId: string, limit = 50): NotificationRow[] {
    const rows = this.database
      .prepare(
        `select id, kind, tmdb_id, media_type, title, created_at, read_at
         from notifications
         where user_id = ?
         order by created_at desc
         limit ?`,
      )
      .all(userId, limit) as Array<{
        id: string
        kind: NotificationKindRow
        tmdb_id: number
        media_type: 'movie' | 'tv'
        title: string
        created_at: string
        read_at: string | null
      }>
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      tmdbId: row.tmdb_id,
      mediaType: row.media_type,
      title: row.title,
      createdAt: row.created_at,
      read: row.read_at !== null,
    }))
  }

  countUnread(userId: string): number {
    const row = this.database
      .prepare('select count(*) as count from notifications where user_id = ? and read_at is null')
      .get(userId) as { count: number }
    return Number(row.count)
  }

  markNotificationsRead(userId: string) {
    this.database
      .prepare('update notifications set read_at = ? where user_id = ? and read_at is null')
      .run(new Date().toISOString(), userId)
  }
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm --filter @lolarr/api exec vitest run tests/database.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/database.ts apps/api/tests/database.test.ts
git commit -m "feat(api): add notifications table and database methods"
```

---

### Task 3: Webhook-Mapping (pure Funktion)

**Files:**
- Create: `apps/api/src/adapters/seerrWebhook.ts`
- Test: `apps/api/tests/seerr-webhook.test.ts`

**Interfaces:**
- Produces: `seerrWebhookSchema` (Zod), `type SeerrWebhookPayload`,
  `mapWebhookToNotification(payload): { kind, tmdbId, mediaType, title, username } | null`.
  `kind` ist `'available'|'approved'|'declined'|'failed'` (kompatibel zu `NotificationKindRow` aus Task 2).

- [ ] **Step 1: Failing test** — `apps/api/tests/seerr-webhook.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mapWebhookToNotification, seerrWebhookSchema } from '../src/adapters/seerrWebhook.js'

function payload(overrides: Record<string, unknown> = {}) {
  return {
    notification_type: 'MEDIA_AVAILABLE',
    subject: 'Fight Club (1999)',
    media: { media_type: 'movie', tmdbId: '550', status: 'available' },
    request: { request_id: '7', requestedBy_username: 'joel' },
    ...overrides,
  }
}

describe('mapWebhookToNotification', () => {
  it('maps MEDIA_AVAILABLE and coerces tmdbId to a number', () => {
    const result = mapWebhookToNotification(seerrWebhookSchema.parse(payload()))
    expect(result).toEqual({ kind: 'available', tmdbId: 550, mediaType: 'movie', title: 'Fight Club (1999)', username: 'joel' })
  })

  it.each([
    ['MEDIA_APPROVED', 'approved'],
    ['MEDIA_DECLINED', 'declined'],
    ['MEDIA_FAILED', 'failed'],
  ])('maps %s to %s', (type, kind) => {
    const result = mapWebhookToNotification(seerrWebhookSchema.parse(payload({ notification_type: type })))
    expect(result?.kind).toBe(kind)
  })

  it.each(['MEDIA_AUTO_APPROVED', 'MEDIA_PENDING', 'TEST_NOTIFICATION', 'SOMETHING_ELSE'])(
    'returns null for the no-op type %s',
    (type) => {
      expect(mapWebhookToNotification(seerrWebhookSchema.parse(payload({ notification_type: type })))).toBeNull()
    },
  )

  it('returns null when the requesting user is missing', () => {
    expect(mapWebhookToNotification(seerrWebhookSchema.parse(payload({ request: {} })))).toBeNull()
  })

  it('returns null when media or subject is missing', () => {
    expect(mapWebhookToNotification(seerrWebhookSchema.parse(payload({ subject: undefined })))).toBeNull()
    expect(mapWebhookToNotification(seerrWebhookSchema.parse(payload({ media: undefined })))).toBeNull()
  })

  it('ignores unknown extra fields (passthrough)', () => {
    const result = mapWebhookToNotification(seerrWebhookSchema.parse(payload({ image: 'http://x/y.jpg', extra: [] })))
    expect(result?.kind).toBe('available')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm --filter @lolarr/api exec vitest run tests/seerr-webhook.test.ts`
Expected: FAIL — Modul existiert nicht.

- [ ] **Step 3: Implement** — `apps/api/src/adapters/seerrWebhook.ts`:

```ts
import { z } from 'zod'

export const seerrWebhookSchema = z
  .object({
    notification_type: z.string(),
    subject: z.string().optional(),
    media: z
      .object({
        media_type: z.enum(['movie', 'tv']),
        tmdbId: z.coerce.number().int(),
        status: z.string().optional(),
      })
      .optional(),
    request: z
      .object({
        request_id: z.string().optional(),
        requestedBy_username: z.string().optional(),
        requestedBy_email: z.string().optional(),
      })
      .optional(),
  })
  .passthrough()

export type SeerrWebhookPayload = z.infer<typeof seerrWebhookSchema>

type NotificationKind = 'available' | 'approved' | 'declined' | 'failed'

export type MappedNotification = {
  kind: NotificationKind
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  username: string
}

// MEDIA_AUTO_APPROVED is intentionally omitted: an auto-approved request needs
// no "approved" toast because MEDIA_AVAILABLE follows once it downloads.
const TYPE_TO_KIND: Record<string, NotificationKind | undefined> = {
  MEDIA_AVAILABLE: 'available',
  MEDIA_APPROVED: 'approved',
  MEDIA_DECLINED: 'declined',
  MEDIA_FAILED: 'failed',
}

export function mapWebhookToNotification(payload: SeerrWebhookPayload): MappedNotification | null {
  const kind = TYPE_TO_KIND[payload.notification_type]
  const username = payload.request?.requestedBy_username
  if (!kind || !payload.media || !payload.subject || !username) {
    return null
  }
  return {
    kind,
    tmdbId: payload.media.tmdbId,
    mediaType: payload.media.media_type,
    title: payload.subject,
    username,
  }
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm --filter @lolarr/api exec vitest run tests/seerr-webhook.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/adapters/seerrWebhook.ts apps/api/tests/seerr-webhook.test.ts
git commit -m "feat(api): map seerr webhook payloads to notifications"
```

---

### Task 4: Config + Webhook-Route (Ingestion)

**Files:**
- Modify: `apps/api/src/config.ts`, `apps/api/tests/helpers.ts`, `apps/api/tests/config.test.ts`
- Modify: `apps/api/src/plugins/auth.ts`
- Create: `apps/api/src/modules/webhooks.ts`
- Modify: `apps/api/src/server.ts`
- Test: `apps/api/tests/webhooks.test.ts`

**Interfaces:**
- Consumes: `mapWebhookToNotification`/`seerrWebhookSchema` (Task 3), `database.findUserByName`/`insertNotification` (Task 2).
- Produces: Route `POST /api/webhooks/seerr`; `config.LOLARR_WEBHOOK_SECRET`; Export `webhooksRoutes(app, context)`.

- [ ] **Step 1: Failing test** — `apps/api/tests/webhooks.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createServer } from '../src/server.js'
import { LolarrDatabase } from '../src/services/database.js'
import { createTestContext, loginTestUser } from './helpers.js'

const SECRET = 'test-webhook-secret-1234'

function webhookBody(overrides: Record<string, unknown> = {}) {
  return {
    notification_type: 'MEDIA_AVAILABLE',
    subject: 'Fight Club (1999)',
    media: { media_type: 'movie', tmdbId: '550', status: 'available' },
    request: { request_id: '7', requestedBy_username: 'joel' },
    ...overrides,
  }
}

async function postWebhook(app: FastifyInstance, body: unknown, secret = SECRET) {
  return app.inject({
    method: 'POST',
    url: '/api/webhooks/seerr',
    headers: { authorization: secret, 'content-type': 'application/json' },
    payload: body,
  })
}

describe('POST /api/webhooks/seerr', () => {
  let ctx: ReturnType<typeof createTestContext>
  let app: FastifyInstance

  beforeEach(async () => {
    ctx = createTestContext()
    app = createServer(ctx.config)
    await loginTestUser(app, ctx) // creates user id 'jf-user-1', name 'Joel'
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  function storedNotifications() {
    const db = new LolarrDatabase(ctx.config.LOLARR_DATABASE_PATH, ctx.config.LOLARR_SECRET)
    return db.listNotifications('jf-user-1')
  }

  it('rejects a wrong secret with 401', async () => {
    const response = await postWebhook(app, webhookBody(), 'wrong-secret')
    expect(response.statusCode).toBe(401)
    expect(storedNotifications()).toHaveLength(0)
  })

  it('rejects a malformed body with 400', async () => {
    const response = await postWebhook(app, { hello: 'world' })
    expect(response.statusCode).toBe(400)
  })

  it('stores a notification for a matching user (200)', async () => {
    const response = await postWebhook(app, webhookBody())
    expect(response.statusCode).toBe(200)
    const rows = storedNotifications()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: 'available', tmdbId: 550, title: 'Fight Club (1999)' })
  })

  it('acks but drops a no-op notification type (200, no row)', async () => {
    const response = await postWebhook(app, webhookBody({ notification_type: 'MEDIA_PENDING' }))
    expect(response.statusCode).toBe(200)
    expect(storedNotifications()).toHaveLength(0)
  })

  it('acks but drops an unknown user (200, no row)', async () => {
    const response = await postWebhook(app, webhookBody({ request: { requestedBy_username: 'stranger' } }))
    expect(response.statusCode).toBe(200)
    expect(storedNotifications()).toHaveLength(0)
  })

  it('dedupes repeated webhooks for the same event', async () => {
    await postWebhook(app, webhookBody())
    await postWebhook(app, webhookBody())
    expect(storedNotifications()).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm --filter @lolarr/api exec vitest run tests/webhooks.test.ts`
Expected: FAIL — `LOLARR_WEBHOOK_SECRET` fehlt in der Test-Config / Route existiert nicht.

- [ ] **Step 3: Implement**

(a) `apps/api/src/config.ts` — im `envSchema` nach `LOLARR_SECRET` einfügen:

```ts
  LOLARR_WEBHOOK_SECRET: z.string().min(16),
```

(b) `apps/api/tests/helpers.ts` — im `config`-Literal von `createTestContext` ergänzen:

```ts
    LOLARR_WEBHOOK_SECRET: 'test-webhook-secret-1234',
```

(c) `apps/api/tests/config.test.ts` — `validEnv` um `LOLARR_WEBHOOK_SECRET: 'test-webhook-secret-1234'`
ergänzen und `'LOLARR_WEBHOOK_SECRET'` in das `it.each([...])`-Array der Missing-Var-Cases aufnehmen.

(d) `apps/api/src/plugins/auth.ts` — `PUBLIC_PREFIXES` erweitern:

```ts
const PUBLIC_PREFIXES = ['/api/auth/', '/api/webhooks/']
```

(e) `apps/api/src/modules/webhooks.ts` (neu):

```ts
import { randomUUID, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { mapWebhookToNotification, seerrWebhookSchema } from '../adapters/seerrWebhook.js'
import type { AppContext } from '../lib/context.js'

// Public endpoint: rate-limit like the other unauthenticated routes.
const WEBHOOK_RATE_LIMIT = { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }

export async function webhooksRoutes(app: FastifyInstance, { config, database }: AppContext) {
  app.post('/api/webhooks/seerr', WEBHOOK_RATE_LIMIT, async (request, reply) => {
    if (!isAuthorized(request.headers.authorization, config.LOLARR_WEBHOOK_SECRET)) {
      return reply.code(401).send({ error: 'Invalid webhook secret' })
    }

    const parsed = seerrWebhookSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Malformed webhook payload' })
    }

    const mapped = mapWebhookToNotification(parsed.data)
    if (!mapped) {
      return { ok: true }
    }

    const user = database.findUserByName(mapped.username)
    if (!user) {
      request.log.warn({ username: mapped.username }, 'seerr webhook for an unknown user — dropped')
      return { ok: true }
    }

    database.insertNotification({
      id: randomUUID(),
      userId: user.id,
      kind: mapped.kind,
      tmdbId: mapped.tmdbId,
      mediaType: mapped.mediaType,
      title: mapped.title,
    })
    return { ok: true }
  })
}

function isAuthorized(header: string | undefined, secret: string): boolean {
  if (!header) {
    return false
  }
  const provided = Buffer.from(header)
  const expected = Buffer.from(secret)
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}
```

(f) `apps/api/src/server.ts` — importieren und registrieren:

```ts
import { webhooksRoutes } from './modules/webhooks.js'
// ... innerhalb createServer, bei den app.register(...)-Aufrufen:
  app.register(webhooksRoutes, context)
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm --filter @lolarr/api exec vitest run tests/webhooks.test.ts tests/config.test.ts`
Expected: PASS (beide Dateien).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/config.ts apps/api/src/plugins/auth.ts apps/api/src/modules/webhooks.ts apps/api/src/server.ts apps/api/tests/helpers.ts apps/api/tests/config.test.ts apps/api/tests/webhooks.test.ts
git commit -m "feat(api): ingest seerr webhooks behind a shared secret"
```

---

### Task 5: Notifications-API-Routen

**Files:**
- Create: `apps/api/src/modules/notifications.ts`
- Modify: `apps/api/src/server.ts`
- Test: `apps/api/tests/notifications.test.ts`

**Interfaces:**
- Consumes: `database.listNotifications`/`countUnread`/`markNotificationsRead` (Task 2), Webhook-Route (Task 4) zum Seeden im Test.
- Produces: `GET /api/notifications` → `{ notifications: NotificationRow[], unreadCount }`;
  `POST /api/notifications/read` → `{ unreadCount: 0 }`; Export `notificationsRoutes(app, context)`.

- [ ] **Step 1: Failing test** — `apps/api/tests/notifications.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createServer } from '../src/server.js'
import { createTestContext, loginTestUser } from './helpers.js'

const SECRET = 'test-webhook-secret-1234'

async function seedWebhook(app: FastifyInstance, tmdbId: number, title: string) {
  await app.inject({
    method: 'POST',
    url: '/api/webhooks/seerr',
    headers: { authorization: SECRET, 'content-type': 'application/json' },
    payload: {
      notification_type: 'MEDIA_AVAILABLE',
      subject: title,
      media: { media_type: 'movie', tmdbId: String(tmdbId) },
      request: { requestedBy_username: 'joel' },
    },
  })
}

describe('notifications routes', () => {
  let ctx: ReturnType<typeof createTestContext>
  let app: FastifyInstance
  let token: string

  beforeEach(async () => {
    ctx = createTestContext()
    app = createServer(ctx.config)
    token = (await loginTestUser(app, ctx)).token
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('requires a session', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/notifications' })
    expect(response.statusCode).toBe(401)
  })

  it('returns notifications and the unread count', async () => {
    await seedWebhook(app, 550, 'Fight Club')
    const response = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.unreadCount).toBe(1)
    expect(body.notifications).toHaveLength(1)
    expect(body.notifications[0]).toMatchObject({ kind: 'available', title: 'Fight Club', read: false })
  })

  it('marks everything read', async () => {
    await seedWebhook(app, 550, 'Fight Club')
    const read = await app.inject({
      method: 'POST',
      url: '/api/notifications/read',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(read.statusCode).toBe(200)
    expect(read.json().unreadCount).toBe(0)

    const after = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(after.json().unreadCount).toBe(0)
    expect(after.json().notifications[0].read).toBe(true)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm --filter @lolarr/api exec vitest run tests/notifications.test.ts`
Expected: FAIL — Routen existieren nicht (`GET /api/notifications` → 404, nicht 200).

- [ ] **Step 3: Implement**

(a) `apps/api/src/modules/notifications.ts` (neu):

```ts
import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../lib/context.js'

export async function notificationsRoutes(app: FastifyInstance, { database }: AppContext) {
  app.get('/api/notifications', async (request) => {
    const userId = request.session.user.id
    return {
      notifications: database.listNotifications(userId),
      unreadCount: database.countUnread(userId),
    }
  })

  app.post('/api/notifications/read', async (request) => {
    const userId = request.session.user.id
    database.markNotificationsRead(userId)
    return { unreadCount: database.countUnread(userId) }
  })
}
```

(b) `apps/api/src/server.ts` — importieren und registrieren:

```ts
import { notificationsRoutes } from './modules/notifications.js'
// ... bei den app.register(...)-Aufrufen:
  app.register(notificationsRoutes, context)
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm --filter @lolarr/api exec vitest run tests/notifications.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/notifications.ts apps/api/src/server.ts apps/api/tests/notifications.test.ts
git commit -m "feat(api): serve per-user notifications and mark-read"
```

---

### Task 6: UI — ToastStack + Styles

**Files:**
- Create: `packages/ui/src/components/ToastStack.tsx`
- Modify: `packages/ui/src/styles.css` (append)
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/tests/ToastStack.test.tsx`

**Interfaces:**
- Produces: `ToastStack({ toasts })` (rein präsentational, nicht-interaktiv), Typen
  `ToastKind = 'available'|'approved'|'declined'|'failed'`, `ToastItem = { id, kind, title }`.
  CSS-Klassen `.toast-stack`, `.toast`, `.toast-<kind>`, `.nav-badge`.

- [ ] **Step 1: Failing test** — `packages/ui/tests/ToastStack.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ToastStack, type ToastItem } from '../src/components/ToastStack.js'

const toasts: ToastItem[] = [
  { id: 'a', kind: 'available', title: 'Dune' },
  { id: 'b', kind: 'failed', title: 'Tenet' },
]

describe('ToastStack', () => {
  afterEach(cleanup)

  it('renders one message per toast with a kind-specific class', () => {
    const { container } = render(<ToastStack toasts={toasts} />)
    expect(screen.getByText('Dune is now available')).toBeDefined()
    expect(screen.getByText('Tenet failed to process')).toBeDefined()
    expect(container.querySelector('.toast-available')).not.toBeNull()
    expect(container.querySelector('.toast-failed')).not.toBeNull()
  })

  it('renders nothing when empty', () => {
    const { container } = render(<ToastStack toasts={[]} />)
    expect(container.querySelector('.toast-stack')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm --filter @lolarr/ui exec vitest run tests/ToastStack.test.tsx`
Expected: FAIL — Modul existiert nicht.

- [ ] **Step 3: Implement**

(a) `packages/ui/src/components/ToastStack.tsx` (neu):

```tsx
export type ToastKind = 'available' | 'approved' | 'declined' | 'failed'

export type ToastItem = {
  id: string
  kind: ToastKind
  title: string
}

const MESSAGE: Record<ToastKind, (title: string) => string> = {
  available: (title) => `${title} is now available`,
  approved: (title) => `${title} was approved`,
  declined: (title) => `${title} was declined`,
  failed: (title) => `${title} failed to process`,
}

// Purely presentational and non-interactive: removal is timer-driven by the
// ToastProvider. No Norigin focusable is registered, so the TV remote never
// lands on a toast.
export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) {
    return null
  }
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.kind}`}>
          {MESSAGE[toast.kind](toast.title)}
        </div>
      ))}
    </div>
  )
}
```

(b) `packages/ui/src/styles.css` — am Ende anhängen:

```css
.toast-stack {
  position: fixed;
  top: 1.5rem;
  right: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 1000;
  pointer-events: none;
  max-width: min(90vw, 22rem);
}

.toast {
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  background: rgba(20, 20, 28, 0.95);
  color: #fff;
  font-size: 0.95rem;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  border-left: 4px solid #6b7280;
}

.toast-available { border-left-color: #22c55e; }
.toast-approved { border-left-color: #3b82f6; }
.toast-declined { border-left-color: #f59e0b; }
.toast-failed { border-left-color: #ef4444; }

.nav-badge {
  display: inline-block;
  min-width: 1.25rem;
  margin-left: 0.4rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 0.75rem;
  line-height: 1.25rem;
  text-align: center;
}
```

(c) `packages/ui/src/index.ts` — Export ergänzen (alphabetisch nahe `StatusBadge`):

```ts
export { ToastStack, type ToastItem, type ToastKind } from './components/ToastStack'
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm --filter @lolarr/ui exec vitest run tests/ToastStack.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/ToastStack.tsx packages/ui/src/styles.css packages/ui/src/index.ts packages/ui/tests/ToastStack.test.tsx
git commit -m "feat(ui): add non-interactive ToastStack and notification badge styles"
```

---

### Task 7: Features — ToastProvider + useToast

**Files:**
- Create: `packages/features/src/notifications/ToastProvider.tsx`
- Test: `packages/features/tests/ToastProvider.test.tsx`

**Interfaces:**
- Consumes: `ToastStack`, `type ToastKind` aus `@lolarr/ui` (Task 6).
- Produces: `ToastProvider({ children })` (rendert `children` + `ToastStack`); Hook
  `useToast(): { show: (toast: { kind: ToastKind; title: string }) => void }`. Auto-Dismiss nach 5 s.

- [ ] **Step 1: Failing test** — `packages/features/tests/ToastProvider.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from '../src/notifications/ToastProvider.js'

function Trigger() {
  const { show } = useToast()
  return (
    <button onClick={() => show({ kind: 'available', title: 'Dune' })}>notify</button>
  )
}

describe('ToastProvider', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('shows a toast on show() and auto-dismisses it after 5s', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('notify'))
    expect(screen.getByText('Dune is now available')).toBeDefined()

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.queryByText('Dune is now available')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm --filter @lolarr/features exec vitest run tests/ToastProvider.test.tsx`
Expected: FAIL — Modul existiert nicht.

- [ ] **Step 3: Implement** — `packages/features/src/notifications/ToastProvider.tsx`:

```tsx
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { ToastStack, type ToastItem, type ToastKind } from '@lolarr/ui'

const TOAST_TTL_MS = 5000

type ToastContextValue = {
  show: (toast: { kind: ToastKind; title: string }) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    ({ kind, title }: { kind: ToastKind; title: string }) => {
      counter.current += 1
      const id = `toast-${counter.current}`
      setToasts((current) => [...current, { id, kind, title }])
      setTimeout(() => dismiss(id), TOAST_TTL_MS)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <ToastStack toasts={toasts} />
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider, matches api.tsx
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm --filter @lolarr/features exec vitest run tests/ToastProvider.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/features/src/notifications/ToastProvider.tsx packages/features/tests/ToastProvider.test.tsx
git commit -m "feat(features): add ToastProvider with auto-dismissing toasts"
```

---

### Task 8: Features — NotificationsProvider + useNotifications

**Files:**
- Create: `packages/features/src/notifications/NotificationsProvider.tsx`
- Test: `packages/features/tests/NotificationsProvider.test.tsx`

**Interfaces:**
- Consumes: `useApi()` aus `../api.js` (liefert `notifications()`/`markNotificationsRead()` — Task 1),
  `useToast()` aus `./ToastProvider.js` (Task 7), TanStack Query.
- Produces: `NotificationsProvider({ apiBaseUrl, enabled, children })`; Hook
  `useNotificationsContext(): { unreadCount: number; markRead: () => void }`.

- [ ] **Step 1: Failing test** — `packages/features/tests/NotificationsProvider.test.tsx`:

```tsx
// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const show = vi.fn()
const notifications = vi.fn()
const markNotificationsRead = vi.fn().mockResolvedValue({ unreadCount: 0 })

vi.mock('../src/api.js', () => ({ useApi: () => ({ notifications, markNotificationsRead }) }))
vi.mock('../src/notifications/ToastProvider.js', () => ({ useToast: () => ({ show }) }))

import { NotificationsProvider, useNotificationsContext } from '../src/notifications/NotificationsProvider.js'

const AVAILABLE = { id: 'n1', kind: 'available', tmdbId: 1, mediaType: 'movie', title: 'A', createdAt: '2026-07-04T00:00:00Z', read: false }
const APPROVED = { id: 'n2', kind: 'approved', tmdbId: 2, mediaType: 'movie', title: 'B', createdAt: '2026-07-04T00:01:00Z', read: false }

function Consumer() {
  const { unreadCount, markRead } = useNotificationsContext()
  return (
    <div>
      <span>unread:{unreadCount}</span>
      <button onClick={markRead}>read</button>
    </div>
  )
}

function renderProvider(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationsProvider apiBaseUrl="http://api" enabled>
        <Consumer />
      </NotificationsProvider>
    </QueryClientProvider>,
  )
}

describe('NotificationsProvider', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('seeds the backlog without toasting, then toasts only new arrivals', async () => {
    notifications
      .mockResolvedValueOnce({ notifications: [AVAILABLE], unreadCount: 1 })
      .mockResolvedValue({ notifications: [APPROVED, AVAILABLE], unreadCount: 2 })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    renderProvider(queryClient)

    await screen.findByText('unread:1')
    expect(show).not.toHaveBeenCalled()

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
    })
    await screen.findByText('unread:2')
    expect(show).toHaveBeenCalledTimes(1)
    expect(show).toHaveBeenCalledWith({ kind: 'approved', title: 'B' })
  })

  it('marks read via the api', async () => {
    notifications.mockResolvedValue({ notifications: [], unreadCount: 0 })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    renderProvider(queryClient)
    await screen.findByText('unread:0')

    await act(async () => {
      fireEvent.click(screen.getByText('read'))
    })
    expect(markNotificationsRead).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm --filter @lolarr/features exec vitest run tests/NotificationsProvider.test.tsx`
Expected: FAIL — Modul existiert nicht.

- [ ] **Step 3: Implement** — `packages/features/src/notifications/NotificationsProvider.tsx`:

```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react'
import { useApi } from '../api.js'
import { useToast } from './ToastProvider.js'

const POLL_INTERVAL_MS = 45_000

type NotificationsContextValue = {
  unreadCount: number
  markRead: () => void
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined)

export function NotificationsProvider({
  apiBaseUrl,
  enabled,
  children,
}: {
  apiBaseUrl: string
  enabled: boolean
  children: ReactNode
}) {
  const api = useApi()
  const toast = useToast()
  const queryClient = useQueryClient()
  const seenIds = useRef<Set<string> | null>(null)

  const query = useQuery({
    queryKey: ['notifications', apiBaseUrl],
    queryFn: () => api.notifications(),
    enabled,
    refetchInterval: POLL_INTERVAL_MS,
  })

  const notifications = query.data?.notifications
  useEffect(() => {
    if (!notifications) {
      return
    }
    // First successful load seeds the seen-set without toasting the backlog;
    // only notifications that arrive after mount produce a toast.
    if (seenIds.current === null) {
      seenIds.current = new Set(notifications.map((item) => item.id))
      return
    }
    for (const item of notifications) {
      if (!seenIds.current.has(item.id)) {
        seenIds.current.add(item.id)
        if (!item.read) {
          toast.show({ kind: item.kind, title: item.title })
        }
      }
    }
  }, [notifications, toast])

  const markMutation = useMutation({
    mutationFn: () => api.markNotificationsRead(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  // markMutation.mutate is referentially stable across renders (TanStack Query),
  // so markRead is stable too — RequestsScreen can use it as an effect dependency.
  const mutate = markMutation.mutate
  const markRead = useCallback(() => {
    mutate()
  }, [mutate])

  const value: NotificationsContextValue = {
    unreadCount: query.data?.unreadCount ?? 0,
    markRead,
  }

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider, matches api.tsx
export function useNotificationsContext(): NotificationsContextValue {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error('useNotificationsContext must be used within a NotificationsProvider')
  }
  return context
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm --filter @lolarr/features exec vitest run tests/NotificationsProvider.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/features/src/notifications/NotificationsProvider.tsx packages/features/tests/NotificationsProvider.test.tsx
git commit -m "feat(features): poll notifications, toast new arrivals once, expose unread badge"
```

---

### Task 9: Verdrahtung (experience/Home/Requests) + Doku + Final-Review

**Files:**
- Modify: `packages/features/src/experience.tsx`
- Modify: `packages/features/src/home/HomeScreen.tsx`
- Modify: `packages/features/src/requests/RequestsScreen.tsx`
- Modify: `.env.example`, `README.md`

**Interfaces:**
- Consumes: `ToastProvider` (Task 7), `NotificationsProvider`/`useNotificationsContext` (Task 8).

- [ ] **Step 1: Failing test** — die Badge-Sichtbarkeit auf dem HomeScreen absichern. Neue Datei
  `packages/features/tests/HomeScreenBadge.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ActionComponent } from '@lolarr/ui'

vi.mock('../src/home/useHome.js', () => ({ useHome: () => ({ data: { rows: [] }, isLoading: false, error: null, refetch: vi.fn() }) }))
vi.mock('../src/requests/useRequests.js', () => ({ useRequests: () => ({ requests: [], requestsError: null }) }))
vi.mock('@lolarr/jellyfin', () => ({ readJellyfinSession: () => null }))

const unread = { value: 0 }
vi.mock('../src/notifications/NotificationsProvider.js', () => ({
  useNotificationsContext: () => ({ unreadCount: unread.value, markRead: vi.fn() }),
}))

import { HomeScreen } from '../src/home/HomeScreen.js'

const Action: ActionComponent = ({ onPress, children }) => <button onClick={onPress}>{children}</button>

const storage = { get: () => null, set: () => {}, remove: () => {} }

function renderHome() {
  render(
    <HomeScreen
      Action={Action}
      storage={storage}
      apiBaseUrl="http://api"
      userName="Joel"
      onSignOut={vi.fn()}
      canConfigureGateway={false}
      onConfigureGateway={vi.fn()}
      onOpenItem={vi.fn()}
      onPlayItem={vi.fn()}
      onOpenSearch={vi.fn()}
      onOpenRequests={vi.fn()}
    />,
  )
}

describe('HomeScreen notification badge', () => {
  afterEach(cleanup)

  it('hides the badge when there are no unread notifications', () => {
    unread.value = 0
    renderHome()
    expect(document.querySelector('.nav-badge')).toBeNull()
  })

  it('shows the unread count on the Requests entry', () => {
    unread.value = 3
    renderHome()
    expect(screen.getByText('3')).toBeDefined()
    expect(document.querySelector('.nav-badge')?.textContent).toBe('3')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm --filter @lolarr/features exec vitest run tests/HomeScreenBadge.test.tsx`
Expected: FAIL — HomeScreen liest `useNotificationsContext` noch nicht / kein `.nav-badge`.

- [ ] **Step 3: Implement**

(a) `packages/features/src/experience.tsx` — imports ergänzen:

```ts
import { NotificationsProvider } from './notifications/NotificationsProvider.js'
import { ToastProvider } from './notifications/ToastProvider.js'
```

Den eingeloggten Zweig umbauen: **nach** dem `if (!auth.user) { ... }`-Block die bestehenden
`if (currentScreen.name === ...) return (...)`-Zweige (player/detail/libraryDetail/search/requests)
sowie den finalen `return <HomeScreen .../>` in eine lokale Funktion `renderScreen()` verschieben
(Rümpfe unverändert lassen, nur `return` innerhalb der Funktion behalten), und am Ende der
Komponente:

```tsx
  function renderScreen() {
    if (currentScreen.name === 'player') {
      return (
        <PlayerScreen
          /* ... unveränderte Props ... */
        />
      )
    }
    // ... die übrigen if-Zweige unverändert ...
    return (
      <HomeScreen
        /* ... unveränderte Props ... */
      />
    )
  }

  return (
    <ToastProvider>
      <NotificationsProvider apiBaseUrl={apiBaseUrl} enabled={Boolean(token)}>
        {renderScreen()}
      </NotificationsProvider>
    </ToastProvider>
  )
```

(b) `packages/features/src/home/HomeScreen.tsx` — Import + Badge:

```ts
import { useNotificationsContext } from '../notifications/NotificationsProvider.js'
```

In der Komponente (bei den anderen Hook-Aufrufen):

```ts
  const { unreadCount } = useNotificationsContext()
```

Den Requests-Button in `.home-header-row` ersetzen durch:

```tsx
        <Action className="ghost-action" onPress={onOpenRequests} focusKey="home-requests">
          Requests{unreadCount > 0 ? <span className="nav-badge">{unreadCount}</span> : null}
        </Action>
```

(c) `packages/features/src/requests/RequestsScreen.tsx` — beim Öffnen alles gelesen markieren:

```ts
import { useEffect } from 'react'
import { useNotificationsContext } from '../notifications/NotificationsProvider.js'
```

In der Komponente (nach dem `useRequests`-Aufruf):

```ts
  const { markRead } = useNotificationsContext()
  useEffect(() => {
    markRead()
  }, [markRead])
```

(d) `.env.example` — Zeile ergänzen:

```
LOLARR_WEBHOOK_SECRET=replace-with-at-least-16-characters
```

(e) `README.md` — neuen Abschnitt einfügen (z.B. vor `## Apps`):

```markdown
## Notifications

Lolarr surfaces request-lifecycle updates (available / approved / declined / failed) as a
one-time toast plus an unread badge on the Requests entry. It relies on Seerr's webhook agent:

- Set `LOLARR_WEBHOOK_SECRET` (16+ chars) in the API environment.
- In Seerr: **Settings → Notifications → Webhook** → enable it, set the Webhook URL to
  `http://<lolarr-api-host>:4000/api/webhooks/seerr`, put the same secret in the
  **Authorization Header** field, and tick the *Available*, *Approved*, *Declined*, and
  *Request Automatically Approved/Failed* notification types.
- Matching is by Jellyfin username; a user only sees notifications for their own requests.
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm --filter @lolarr/features exec vitest run tests/HomeScreenBadge.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full verification gate**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm --filter @lolarr/web build && pnpm --filter @lolarr/tv build
```
Expected: alles grün. (Beim Subagent-Driven-Flow folgt danach der Whole-Branch-Review.)

- [ ] **Step 6: Commit**

```bash
git add packages/features/src/experience.tsx packages/features/src/home/HomeScreen.tsx packages/features/src/requests/RequestsScreen.tsx packages/features/tests/HomeScreenBadge.test.tsx .env.example README.md
git commit -m "feat: wire notification toasts and unread badge into the app"
```

---

## Notes on decisions carried from the spec

- Poll (~45 s), nicht SSE. Toast genau einmal pro Gerät (Seed-Set beim ersten Snapshot).
- Dedup-Key `(user_id, tmdb_id, media_type, kind)` — Per-Staffel-`MEDIA_AVAILABLE` kollabiert.
- Raw-SQL (kein Drizzle in dieser Slice); Toast hand-gerollt (kein shadcn/Radix in dieser Slice).
  Beide als eigene Fundament-Slices in der Roadmap (siehe Spec, Abschnitt „Roadmap / Future Work").
