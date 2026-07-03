# Lolarr Slice 1: Fundament + Auth — Design

Datum: 2026-07-03 · Status: entworfen, wartet auf Review

## Kontext

Lolarr ist ein selbst gehosteter, Netflix-artiger Client für **Jellyfin** (Playback) und **Seerr** (Content-Requests) mit den Zielplattformen Web, Desktop, Mobile und Tizen-TV. Gesamtarchitektur (separat entschieden, siehe Roadmap unten): Hybrid-BFF — Metadaten/Auth/Seerr laufen über `apps/api` (Fastify), Bilder und Video-Streams gehen später direkt Client→Jellyfin.

Dieser Slice legt das Fundament: Code-Restrukturierung + vollständiger Auth-Flow. Referenz-Clients für Muster: [Wholphin](https://github.com/damontecres/Wholphin) (Android TV) und [Moonfin](https://github.com/Moonfin-Client/Smart-TV) (Tizen/webOS).

## Ziel & Erfolgskriterium

Nach diesem Slice:

1. Login mit Jellyfin-Credentials (Web) **und** Quick Connect (TV) gegen echte Server.
2. BFF hält pro User: Jellyfin-AccessToken + Seerr-Session (`connect.sid`), beide verschlüsselt in SQLite.
3. Login-Response enthält `jellyfin: { url, accessToken, userId, deviceId }` — Grundlage für spätere Bild-/Stream-Direktzugriffe des Clients.
4. `packages/features` ist in Feature-Module gesplittet, `packages/ui` in Einzelkomponenten, `apps/api` in Module mit zentralem Auth-Hook.
5. Demo-Modus vollständig entfernt; API failt beim Start ohne Konfiguration.
6. Vitest-Integrationstests (API) grün.

## Voraussetzungen (Betreiber-Doku, README)

- **Seerr ≥ v3.4.0** (Quick-Connect-Login, [PR #2212](https://github.com/seerr-team/seerr/pull/2212); bis zum Release `develop`/preview-Image im docker-compose). Kein Fallback für ältere Versionen — ein Code-Pfad.
- Seerr-Settings: **"Jellyfin-Anmeldung aktivieren"** (`mediaServerLogin`) und **"Neue Jellyfin-Anmeldung aktivieren"** (Auto-Anlage beim ersten Login) müssen an sein.
- Jellyfin: **Quick Connect aktiviert** (für TV-Login und Silent-QC).

## Phase 1 — Mechanischer Umbau (keine Verhaltensänderung)

### packages/domain
- Demo-Daten (`demoUser`, `demoRows`, `findDemoItem`, `searchDemoItems`) ersatzlos löschen. Domain = reiner Zod-Contract BFF↔Client.

### apps/api
- Demo-Fallbacks in `adapters/jellyfin.ts` und `adapters/seerr.ts` entfernen. `config.ts`: `JELLYFIN_URL`, `SEERR_URL`, `SEERR_API_KEY`, `LOLARR_SECRET` sind Pflicht → **fail fast beim Start** mit klarer Fehlermeldung.
- Struktur: `modules/auth`, `modules/discover`, `modules/media`, `modules/requests` als Fastify-Plugins (`app.register(...)`); `server.ts` nur noch Komposition.
- `plugins/auth.ts`: preHandler-Hook — **alle Routen unter `/api/*` außer `/api/auth/*` und `/health` verlangen eine gültige Session** (Bearer-Token). Session hängt an `request.session`.
- `plugins/errors.ts`: zentraler Error-Handler. Zod-Fehler → 400, Upstream-Fehler (Jellyfin/Seerr nicht erreichbar) → 502 mit Fehlercode, unbekannt → 500. `fastify-type-provider-zod` für Body-/Query-Validierung.
- Bugfix: `GET /api/requests` filtert nach `requestedBy` (aktuell sieht jeder User alle Requests).
- Bugfix: Seerr-Status-Mapping vervollständigen (MediaStatus 1–7, insb. `4 = PARTIALLY_AVAILABLE`).

### packages/features
- Split der 401-Zeilen-Datei `index.tsx` in:
  - `app.tsx` — nur Provider (QueryClient) + Screen-Switch
  - `navigation/` — Screen-Store mit Back-Stack (zustand; TV-Back-Taste braucht Stack, Player pusht später von außerhalb React)
  - `auth/` — `useSession`, `useLogin`, `LoginScreen`, `GatewayScreen`
  - `home/` — `useDiscover`, `HomeScreen`
  - `detail/` — `useMediaDetail`, `DetailScreen`
  - `search/` — `useSearch` (Eingabe + deferred query)
  - `requests/` — `useRequests`, `useCreateRequest`
- Storage hinter Interface: `SessionStorage`-Adapter (Default: localStorage), injizierbar wie `Action`/`TextInput`/`Shell`. Die bestehenden Adapter-Props bleiben unverändert.

### packages/ui
- `components/streaming.tsx` (520 Zeilen) → eine Datei pro Komponente (`AppFrame.tsx`, `LoginPanel.tsx`, …), `index.ts` re-exportiert. `styles.css` bleibt vorerst eine Datei.

## Phase 2 — Auth-Ausbau

### Passwort-Login (Web)
`POST /api/auth/login` `{ username, password, deviceId }`:
1. Jellyfin `POST /Users/AuthenticateByName` — Header ausschließlich `Authorization: MediaBrowser Client="Lolarr", Device="…", DeviceId="…", Version="…"` (kein `X-Emby-*`, deprecated).
2. Seerr `POST /api/v1/auth/jellyfin` mit denselben Credentials → `connect.sid` aus Set-Cookie.
3. Persistenz am User: Jellyfin-Token + Seerr-Cookie, beide AES-GCM-verschlüsselt (Crypto-Service existiert).
4. Response: `{ token, user, jellyfin: { url, accessToken, userId, deviceId } }`.

`deviceId` generiert der Client einmalig (UUID) und persistiert sie im Storage-Adapter. Jellyfin invalidiert Tokens pro DeviceId — pro Gerät+User eine stabile Id.

### Quick Connect (TV)
- `POST /api/auth/qc/initiate` → BFF ruft Jellyfin `POST /QuickConnect/Initiate` → `{ code, pollToken }` (pollToken = serverseitig gehaltenes QC-Secret, nicht das rohe Jellyfin-Secret an den Client).
- Client zeigt Code an, pollt `GET /api/auth/qc/state?pollToken=…` alle 5 s.
- Nach Freigabe (am Handy in der Jellyfin-App): BFF `POST /Users/AuthenticateWithQuickConnect` → AccessToken → Seerr-Session via Silent-QC (s. u.) → normale Lolarr-Session, identische Response wie Passwort-Login.

### Silent Quick Connect (Seerr-Session ohne Passwort)
Immer wenn eine Seerr-Session fehlt oder abgelaufen ist (Seerr antwortet 401) und ein gültiges Jellyfin-Token vorliegt:
1. BFF → Seerr `POST /api/v1/auth/jellyfin/quickconnect/initiate` → `{ code, secret }`
2. BFF → Jellyfin `POST /QuickConnect/Authorize?code=…` — autorisiert mit dem gespeicherten User-Token
3. BFF → Seerr `POST /api/v1/auth/jellyfin/quickconnect/authenticate` → frische `connect.sid`, danach Retry des ursprünglichen Calls (max. 1 Retry)

Damit gibt es genau einen Seerr-Auth-Pfad für QC-Login **und** Cookie-Erneuerung; keine Admin-Key-Impersonation. Der `SEERR_API_KEY` wird ausschließlich für zentrales, user-unabhängiges Discover/Search verwendet (cachebar, reine TMDB-Daten).

### 401-Kaskade
- Jellyfin-Token ungültig (Admin-Revoke o. ä.) → BFF beendet die Lolarr-Session (401) → Client löscht Token via Storage-Adapter, zurück zum Login.
- Seerr-401 → Silent-QC-Erneuerung (kein User-Impact). Schlägt auch die fehl (Jellyfin-Token tot) → Kaskade wie oben.

## Datenmodell (SQLite)

- `users`: + Spalte `seerr_cookie_enc` (AES-GCM). Jellyfin-Token-Spalte existiert. User-Id = Jellyfin-User-Id (bereits so).
- `sessions`: unverändert (Token, 30 Tage TTL).
- Kein Expiry-Tracking fürs Seerr-Cookie — Erneuerung reaktiv über 401 + Silent-QC.
- Keine Migrations-Infrastruktur in diesem Slice; bestehendes `migrate()` ergänzt die Spalte idempotent (`ALTER TABLE` guarded).

## Testing

Vitest-Workspace im Monorepo (`vitest.workspace.ts`), Tests zunächst nur für `apps/api` + Units.

Integrationstests (`fastify.inject` + undici `MockAgent` für Jellyfin/Seerr):
1. Login happy path (beide Upstreams ok → Token + jellyfin-Block in Response)
2. Login: Seerr down → Login gelingt trotzdem (Seerr-Session wird später via Silent-QC nachgeholt)
3. Quick-Connect-Flow: initiate → pending → authenticated → Session
4. Silent-QC: Seerr-Call 401 → Erneuerung → Retry erfolgreich
5. 401-Kaskade: Jellyfin-Token invalid → Lolarr-Session beendet
6. Auth-Hook: `/api/discover` ohne Token → 401
7. Requests-Sichtbarkeit: User A sieht Requests von User B nicht

Units: crypto (round-trip), Session-Store, Seerr-Status-Mapping (alle 7 Stati).

## Fehlerbehandlung (Zusammenfassung)

| Fall | Verhalten |
|---|---|
| Ungültige Credentials | 401 `Invalid Jellyfin credentials` |
| Jellyfin nicht erreichbar | 502 `jellyfin_unreachable` |
| Seerr nicht erreichbar beim Login | Login gelingt, Seerr-Session lazy via Silent-QC |
| Seerr-Cookie abgelaufen | transparent erneuert (Silent-QC), max. 1 Retry |
| Zod-Validierung | 400 mit Feldfehlern |
| Fehlende Env-Config | Prozess startet nicht, klare Meldung |

## Out of Scope (Roadmap, je eigener Slice)

2. Home/Browse mit echten Jellyfin-Daten (Resume/NextUp/Latest, `packages/jellyfin` für Bild-URLs)
3. Playback Web (PlaybackInfo + DeviceProfile, hls.js, Progress-Reporting, `packages/player`)
4. Requests-Ausbau + Availability-Badges (PARTIALLY_AVAILABLE-UI, Seasons)
5. Playback Tizen (AVPlay-Adapter)
6. Seerr-Webhooks → Notifications
- Multi-Server: bewusst nicht (1 Jellyfin, 1 Seerr per Env); Desktop/Mobile-Stubs bleiben unangetastet.
