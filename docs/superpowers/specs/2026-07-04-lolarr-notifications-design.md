# Lolarr Slice 6: Seerr-Webhooks → Notifications — Design-Spec

**Datum:** 2026-07-04
**Status:** Entwurf (User-Review ausstehend)
**Vorgänger:** Slice 1 (Fundament + Auth), Slice 2 (Home/Browse), Slice 3 (Playback Web), Slice 4 (Requests & Availability), Slice 5 (Tizen-TV-Playback)

## Ziel

Seerr benachrichtigt Lolarr per Webhook über den Lebenszyklus einer Anfrage. Lolarr
persistiert diese Ereignisse pro Nutzer und der Client zeigt sie als **Toast** (einmalig)
plus **Unread-Badge** am Requests-Eintrag. So erfährt ein Nutzer, dass sein angefragter
Titel verfügbar (oder abgelehnt/fehlgeschlagen) ist, ohne selbst den Requests-Screen zu
öffnen.

## Nicht-Ziele

- **Kein Realtime-Push (SSE/WebSocket)** — der Client pollt (~45 s). Media-available ist
  Minuten-Skala; SSE lohnt die Tizen-Webview-Komplexität in V1 nicht. Später nachrüstbar.
- **Kein OS-/Web-Push** (proaktiv bei geschlossener App) — auf Tizen nicht möglich, auf Web
  schwergewichtig.
- **Kein separates Notification-Center** (eigener Screen mit Verlauf) — der Requests-Screen
  ist bereits die Liste; Toast + Badge reichen.
- **Kein Per-Staffel-Granularität** — ein `MEDIA_AVAILABLE` pro Serie (Dedup kollabiert
  Staffel-Events).
- **Kein Drizzle/ORM in dieser Slice** — `notifications` bleibt Raw-SQL wie `users`/`sessions`.
  Eine dedizierte „Adopt Drizzle"-Slice migriert die ganze Persistenzschicht später.
- **Keine Headless-UI-Primitives (Radix/Base UI) in dieser Slice** — der Toast wird minimal
  hand-gerollt (custom CSS, TV-sicher). Eine eigene Fundament-Slice entscheidet Radix vs.
  Base UI mit einem Norigin-Koexistenz-Spike und migriert den Toast dann.
- **Kein Per-ID-Read** — `POST /api/notifications/read` markiert alle als gelesen (YAGNI).
- **Kein Retention-Pruning** — Dedup hält die Tabelle klein (≤ 1 Zeile pro user×tmdb×kind).

## Entscheidungen (aus dem Brainstorming)

| Frage | Entscheidung |
|---|---|
| Surface | Toast (einmalig pro Gerät) + Unread-Badge am Requests-Eintrag; serverseitig persistiert/dedupliziert |
| Events | Voller Lebenszyklus: `available`, `approved`, `declined`, `failed` |
| Transport | Client-Poll ~45 s über eigenen `GET /api/notifications` (nicht an Requests-Poll gehängt, nicht SSE) |
| Persistenz | Raw-SQL `notifications`-Tabelle (kein Drizzle jetzt) |
| Toast-Implementierung | Hand-gerollt minimal in `packages/ui` (kein shadcn/Tailwind/Radix jetzt) |
| Nutzer-Matching | `requestedBy_username` case-insensitiv gegen `users.name` (kein Email-Fallback — kein Email-Feld) |

## Architektur & Datenfluss

```
Seerr ──POST /api/webhooks/seerr──▶ BFF ──▶ notifications-Tabelle
  (Authorization: <Secret>)               (dedup: user_id+tmdb_id+media_type+kind, read_at)

Client (web/tv), app-weit solange eingeloggt:
  NotificationsProvider → GET /api/notifications  alle ~45 s → { notifications, unreadCount }
     neue id (vs. lokalem "getoastet"-Set) → useToast().show(...)   → Toast, Ton je kind
     unreadCount                                                    → Badge am Requests-Eintrag
  RequestsScreen mount → POST /api/notifications/read → unreadCount = 0
```

**Kernidee „genau einmal toasten":** Der Server persistiert/dedupliziert; jede Notification
hat eine stabile `id`. Der Client hält ein `useRef<Set<id>>`. Beim **ersten** erfolgreichen
Snapshot werden alle IDs *ohne* Toast ins Set geseedet (Rückstand = nur Badge). Danach toastet
jede neue ungelesene ID genau einmal und wandert ins Set. Read-State (`read_at`) liegt
serverseitig → Badge über Geräte konsistent; der Toast bleibt per-Gerät genau-einmal.

**Poll statt Piggyback:** eigener leichter `GET /api/notifications`-Poll, weil der Requests-Poll
nur auf dem Requests-Screen läuft — Benachrichtigungen müssen app-weit pollen.

## Komponente 1 — Webhook-Ingestion (BFF)

**Route:** `POST /api/webhooks/seerr` in neuem `apps/api/src/modules/webhooks.ts`. Das Präfix
`/api/webhooks/` kommt in `PUBLIC_PREFIXES` (`apps/api/src/plugins/auth.ts`), umgeht also den
Session-Auth-Hook, und opt-in ins Rate-Limit (`config: { rateLimit: {...} }`, wie die
Auth-Endpunkte), da öffentlich.

**Secret:** Seerrs Webhook-Agent erlaubt einen frei konfigurierbaren `Authorization`-Header.
Die Route vergleicht `request.headers.authorization` **konstant-zeitig** (`crypto.timingSafeEqual`,
mit Längen-Guard) gegen `config.LOLARR_WEBHOOK_SECRET`. Mismatch → `401`.

**Payload-Schema (Zod, tolerant — nur genutzte Felder, Rest ignoriert):**
```ts
const seerrWebhookSchema = z.object({
  notification_type: z.string(),
  subject: z.string().optional(),          // Titel, z.B. "Dune: Part Two (2024)"
  media: z.object({
    media_type: z.enum(['movie', 'tv']),
    tmdbId: z.coerce.number().int(),       // Seerr sendet tmdbId als String
    status: z.string().optional(),
  }).optional(),
  request: z.object({
    request_id: z.string().optional(),
    requestedBy_username: z.string().optional(),
    requestedBy_email: z.string().optional(),
  }).optional(),
}).passthrough()
```

**Reine Mapping-Funktion** `mapWebhookToNotification(payload)` (eigene Datei
`apps/api/src/adapters/seerrWebhook.ts`, unit-getestet) →
`{ kind, tmdbId, mediaType, title, username } | null`:

| `notification_type` | → `kind` |
|---|---|
| `MEDIA_AVAILABLE` | `available` |
| `MEDIA_APPROVED` | `approved` |
| `MEDIA_DECLINED` | `declined` |
| `MEDIA_FAILED` | `failed` |
| `MEDIA_AUTO_APPROVED`, `MEDIA_PENDING`, `TEST_NOTIFICATION`, sonst | `null` (No-op) |

`MEDIA_AUTO_APPROVED` bewusst ignoriert (kein manuelles Warten → `available` folgt). `title`
kommt aus `subject`. Fehlt bei einem gemappten Typ `media` oder `subject`, liefert die Funktion
`null` (die Route loggt + antwortet `200`).

**Route-Ablauf:** Secret prüfen → Body parsen → `mapWebhookToNotification` → bei `null`:
`200 {ok:true}` (No-op). Sonst `database.findUserByName(username)` (case-insensitiv) → kein
Treffer: `warn`-Log + `200`. Treffer: `database.insertNotification(...)` mit
`ON CONFLICT(user_id, tmdb_id, media_type, kind) DO NOTHING`.

**Antwort-Policy:** `401` nur bei falschem Secret, `400` nur bei unparsebarem Body, sonst immer
`200` — damit Seerr nicht endlos retryt.

## Komponente 2 — Notifications-API, DB & Config

**DB-Tabelle** (neuer `create table if not exists`-Block in `LolarrDatabase.migrate()`,
idempotent, kein ALTER):
```sql
create table if not exists notifications (
  id text primary key,               -- uuid
  user_id text not null references users(id),
  kind text not null,                -- available | approved | declined | failed
  tmdb_id integer not null,
  media_type text not null,          -- movie | tv
  title text not null,
  created_at text not null default current_timestamp,
  read_at text,                      -- null = ungelesen
  unique(user_id, tmdb_id, media_type, kind)
);
create index if not exists notifications_user_created
  on notifications(user_id, created_at desc);
```

**DB-Methoden** (`apps/api/src/services/database.ts`):
- `insertNotification({ id, userId, kind, tmdbId, mediaType, title })` → `INSERT ... ON CONFLICT DO NOTHING`.
- `findUserByName(name: string)` → `select id, name from users where name = ? collate nocase` → `{ id, name } | undefined`.
- `listNotifications(userId, limit = 50)` → `created_at desc`.
- `countUnread(userId)` → `select count(*) ... where read_at is null`.
- `markNotificationsRead(userId)` → `update ... set read_at = ? where user_id = ? and read_at is null`.

**Endpunkte** (beide authed, neues `apps/api/src/modules/notifications.ts`):
- `GET /api/notifications` → `{ notifications: NotificationDto[], unreadCount: number }`.
  `NotificationDto = { id, kind, tmdbId, mediaType, title, createdAt, read }`. Letzte 50
  (gelesen + ungelesen, damit der Client „neu" erkennt) + `unreadCount`.
- `POST /api/notifications/read` → markiert alle ungelesenen als gelesen → `{ unreadCount: 0 }`.

**Config** (`apps/api/src/config.ts`): `LOLARR_WEBHOOK_SECRET: z.string().min(16)` (required).
In `.env.example` + README dokumentiert. README-Setup Seerr-Seite: Webhook-Agent aktivieren →
Webhook-URL `http://<bff-host>:4000/api/webhooks/seerr`, `Authorization`-Header = das Secret,
die vier Notification-Typen (Available/Approved/Declined/Failed) anhaken.

## Komponente 3 — Client

**domain** (`packages/domain/src/index.ts`):
```ts
export const notificationKindSchema = z.enum(['available', 'approved', 'declined', 'failed'])
export const notificationSchema = z.object({
  id: z.string(),
  kind: notificationKindSchema,
  tmdbId: z.number(),
  mediaType: mediaTypeSchema,          // vorhandenes 'movie' | 'tv'
  title: z.string(),
  createdAt: z.string(),
  read: z.boolean(),
})
export const notificationsResponseSchema = z.object({
  notifications: z.array(notificationSchema),
  unreadCount: z.number(),
})
export type Notification = z.infer<typeof notificationSchema>
export type NotificationKind = z.infer<typeof notificationKindSchema>
```

**api-client** (`packages/api-client`): `notifications(): Promise<NotificationsResponse>`
(`GET /api/notifications`) und `markNotificationsRead(): Promise<{ unreadCount: number }>`
(`POST /api/notifications/read`). Bestehendes Bearer-/`onUnauthorized`-Muster.

**ui `ToastStack`** (`packages/ui`, rein präsentational): Props `{ toasts: {id,kind,title}[], onDismiss(id) }`.
Vier `kind`-Varianten → Farbe/Icon (`available`=success, `approved`=info, `declined`=warning,
`failed`=error). Englische Copy: „{title} is now available", „{title} was approved",
„{title} was declined", „{title} failed to process". Fixed-Overlay, **nicht fokussierbar**
(keine Norigin-`focusable`-Registrierung), damit die TV-Spatial-Nav ungestört bleibt. Nicht
tappbar (der Badge ist der Aktionspfad).

**features `ToastProvider` + `useToast()`** (`packages/features/src/notifications/`): hält die
Toast-Queue + Auto-Dismiss-Timer (~5 s), rendert `ToastStack`. `useToast().show({ kind, title })`
reiht ein.

**features `NotificationsProvider` + `useNotifications`** (`packages/features/src/notifications/`):
- `useQuery({ queryKey: ['notifications', apiBaseUrl], queryFn: () => api.notifications(), enabled, refetchInterval: 45_000 })`.
- Neu-Erkennung via `useRef<Set<string>>`: erster Snapshot seedet alle IDs ohne Toast; danach
  jede neue ungelesene ID → `useToast().show(...)` + ins Set.
- `markRead` (Mutation `POST /api/notifications/read`, invalidiert `['notifications']`).
- Exponiert `{ unreadCount, markRead }` via Context (`useNotificationsContext()`).

**Verdrahtung** (`packages/features/src/experience.tsx`): der eingeloggte Zweig (aktuell die
`if (currentScreen…)`-Kette) wird in einen `renderScreen()`-Helper gezogen und mit
`<ToastProvider><NotificationsProvider apiBaseUrl token>{renderScreen()}</NotificationsProvider></ToastProvider>`
umschlossen (Provider nur gemountet, wenn `auth.user` existiert → Polling app-weit, aber nur
eingeloggt).
- **HomeScreen** liest `unreadCount` aus `useNotificationsContext()` → Unread-Badge an der
  Requests-Schaltfläche (sichtbar bei > 0, versteckt bei 0).
- **RequestsScreen** ruft `markRead()` beim Mount.

## Nutzer-Matching

Der Webhook liefert `requestedBy_username`. Seerr läuft auf Jellyfin-Auth (Voraussetzung des
Silent-QC-Flows aus Slice 1), daher gilt `requestedBy_username` == Jellyfin-Username ==
Lolarr `users.name`. Match case-insensitiv (`collate nocase`). **Kein** Email-Fallback — die
`users`-Tabelle speichert nur `id`/`name`. Kein Treffer (Nutzer war nie in Lolarr eingeloggt)
→ Notification verworfen + geloggt. **Dokumentiertes Risiko:** in Seerr umbenannte
Display-Namen brechen das Matching; akzeptabel für V1.

## Error-Handling & Edge-Cases

- Falsches Secret → `401` (rate-limited, constant-time). Malformed Body → `400`. Unbehandelter
  Typ → `200` No-op. Kein User-Match / fehlende Felder → `warn`-Log + `200`.
- **Dedup** (`unique(user,tmdb,media_type,kind)`): Seerr-Retries + Per-Staffel-`MEDIA_AVAILABLE`
  kollabieren zu einer Zeile. Trade-off: derselbe Titel re-benachrichtigt nicht bei gleichem
  `kind`; `declined`→später `available` sind verschiedene kinds → getrennt.
- **Toast-Backlog-Suppression:** erster Snapshot seedet das Set ohne Toast; Reload zeigt den
  Rückstand nur als Badge, toastet nie erneut.
- **Read-State cross-device:** `read_at` serverseitig → `markRead` nullt den Badge beim nächsten
  Poll überall; Toast bleibt per-Gerät genau-einmal.
- **API-Fehler/Offline:** TanStack-Query-Retry/Backoff, `unreadCount` bleibt stale bis Erfolg,
  kein Toast bei Fehler. `401` → bestehende `onUnauthorized`-Kaskade (Logout). **Logout** →
  Provider unmountet, Polling stoppt.
- **Single-Node/SQLite-Annahme:** kein In-Memory-Fan-out (Poll-Modell), horizontale Skalierung
  out of scope.

## Testing

- **BFF:** `mapWebhookToNotification` (pure: jeder `notification_type` → korrekter `kind`/`null`,
  `tmdbId`-Coercion, fehlende Felder → `null`, `media_type`-Durchreichung). Webhook-Route:
  falsches Secret → `401`; gültiges Secret + `MEDIA_AVAILABLE` + Match → Insert (`200`);
  kein Match → `200` ohne Insert; No-op-Typ/Test → `200`; malformed → `400`; Dedup (zweiter
  identischer Webhook dupliziert nicht). Notifications-Endpunkte: `GET` liefert Liste +
  `unreadCount` (authed; `401` ohne Session); `POST …/read` → `unreadCount 0`. DB: Migration
  legt Tabelle an (frische + bestehende DB), Insert/Dedup, `countUnread`, `markNotificationsRead`,
  `findUserByName` case-insensitiv. Bestehendes Test-Harness-Muster (aus Slice 4).
- **domain:** `notificationSchema`/`notificationsResponseSchema` parsen valide Payloads, lehnen
  ungültigen `kind` ab.
- **Client:** `useNotifications` (erster Snapshot seedet ohne Toast; neue id → genau ein Toast,
  kein Doppel-Toast bei Re-Poll; `unreadCount` exponiert; `markRead` ruft API + nullt).
  `ToastStack` (vier Varianten, `onDismiss` entfernt, nicht fokussierbar). `ToastProvider`/
  `useToast` (`show` reiht ein, Auto-Dismiss via Fake-Timer). HomeScreen-Badge (> 0 sichtbar,
  = 0 versteckt). jsdom + TanStack-Query-Test-Wrapper.

## Global Constraints (Repo-Regeln — binden jeden Task)

- `erasableSyntaxOnly` — **keine** TS-Parameter-Properties; explizite Feld-Deklarationen.
- ESM mit `.js`-Import-Suffixen; `verbatimModuleSyntax` (type-only imports als `import type`).
- Conventional Commits, **Englisch**. UI-Texte **Englisch**.
- `react-refresh/only-export-components` — Hooks/Context neben ihren Providern brauchen ggf.
  denselben `eslint-disable`-Kommentar wie bestehende (`api.tsx`-Muster).
- `webapis`/`tizen` werden nie statisch importiert (hier nicht relevant — Notifications sind
  plattformneutral; der Toast läuft auf web + tv).
- Verifikation: `pnpm test && pnpm typecheck && pnpm lint` + `pnpm --filter @lolarr/web build`
  + `pnpm --filter @lolarr/tv build`.

## Roadmap / Future Work

- **Adopt Drizzle** — dedizierte Data-Layer-Migrations-Slice: `users`/`sessions`/`notifications`
  gemeinsam auf Drizzle (`drizzle-orm/node-sqlite`, kompatibel mit dem bestehenden
  `DatabaseSync`), Migrations-Strategie, kompletter Auth/Session-Pfad re-getestet.
- **Headless-UI-Primitives** — Fundament-Slice: Radix vs. Base UI entscheiden + Norigin-
  Koexistenz-Spike (ein Dialog + ein Toast on-device), dann headless wholesale einziehen und
  den hand-gerollten Toast migrieren.
- SSE/Realtime-Push als Upgrade des Poll-Modells (Live-Kanal auf derselben Persistenz).
- Per-Staffel-Notifications, Retention-Pruning — falls die Tabelle wider Erwarten wächst.
