# Lolarr Slice 4: Requests & Availability — Design-Spec

**Datum:** 2026-07-04
**Status:** Entwurf (User-Review ausstehend)
**Vorgänger:** Slice 1 (Fundament + Auth), Slice 2 (Home/Browse), Slice 3 (Playback Web)

## Ziel

Inhalte finden und anfragen wird ein vollwertiger Flow: eigener Such-Screen, staffelgenaue
TV-Requests, ein Requests-Screen mit echtem Seerr-Status und Stornieren, plus einheitliche
Availability-Darstellung. Seerr wird Source of Truth für Requests — die lokale
Platzhalter-Tabelle aus Slice 1 entfällt.

## Nicht-Ziele

- Keine Quota-Anzeige („N Requests übrig") — Seerr-Fehlermeldungen bei Überschreitung reichen (Backlog).
- Keine Requests fremder User / Admin-Moderation (Approve/Decline) — Seerr-Web bleibt dafür zuständig.
- Keine Push-/Webhook-Statusupdates — das ist Slice 6; Status ist „frisch bei Abruf".
- Kein 4K-/Server-Profil-Handling im Request-Payload.

## Architektur

### Seerr als Source of Truth für Requests

Die lokale `requests`-Tabelle (SQLite) und `database.createRequest/listRequests` werden
entfernt (Migration: `DROP TABLE requests`). Alle Request-Daten kommen live aus Seerr über
die bestehende per-User-Session (`SeerrSessionService.fetchWithSession`, inkl. 401→Silent-QC→Retry).

**BFF-Endpunkte (`apps/api/src/modules/requests.ts`):**

| Route | Upstream | Verhalten |
|---|---|---|
| `GET /api/requests` | `GET /api/v1/request?take=50&sort=added` (User-Session) | Liefert die für den User sichtbaren Requests (Seerr begrenzt Nicht-Admins auf eigene), gemappt auf `MediaRequest[]`, neueste zuerst. |
| `POST /api/requests` | `POST /api/v1/request` (User-Session) | Body neu: `{ mediaType, tmdbId, title, seasons?: number[] }`. TV ohne `seasons` → `seasons: 'all'` (bisheriges Verhalten). Antwort-Status wird aus der Seerr-Response gemappt (nicht mehr hartkodiert `pending` — auto-approved erscheint sofort als `approved`). Discover-Cache-Bust bleibt. |
| `DELETE /api/requests/:id` | `DELETE /api/v1/request/{id}` (User-Session) | Storniert. Seerr erzwingt Berechtigung (eigene, ausstehende); 403/404 werden als `UpstreamError` mit Seerr-Message durchgereicht. |

**Status-Mapping** (Seerr `request.status`: 1=pending, 2=approved, 3=declined, 4=failed;
`media.status`: 1–5 wie Slice-1-Mapping):

| Seerr request.status | media.status | Domain `RequestStatus` |
|---|---|---|
| 1 (pending) | * | `pending` |
| 3 (declined) | * | `declined` (neu im Enum) |
| 4 (failed) | * | `failed` |
| 2 (approved) | 5 (available) | `available` |
| 2 (approved) | 3/4 (processing/partial) | `processing` |
| 2 (approved) | sonst | `approved` |

**Domain-Änderungen (`packages/domain`):**
- `requestStatusSchema` + `'declined'`.
- `mediaRequestSchema` + `seasons: z.array(z.number().int()).optional()` (angeforderte Staffelnummern) und `canCancel: z.boolean()` (vom BFF berechnet: Status `pending` oder `approved`).
- `createRequestSchema` + `seasons: z.array(z.number().int().positive()).nonempty().optional()` (nur bei `mediaType: 'tv'` erlaubt; Route lehnt `seasons` bei `movie` mit 400 ab).
- `mediaResponseSchema` (`GET /api/media/...`) + optional `seasons: [{ seasonNumber, name?, availability }]` bei TV — Quelle: Seerr-TV-Details (`seasons[]` + `mediaInfo.seasons[]`-Status). Specials (`seasonNumber 0`) werden weggelassen.

### Staffel-Requests

`seerr.media('tv', tmdbId)` mappt zusätzlich die Staffel-Liste mit per-Staffel-Availability
(`requestable`/`requested`/`processing`/`partiallyAvailable`/`available`). Der Detail-Screen
öffnet bei TV-Requests ein Overlay statt direkt zu senden:

- **`SeasonRequestPicker`** (packages/ui, neue Komponente): Checkbox-Liste aller Staffeln +
  „All seasons"-Toggle; Staffeln mit Availability ≠ `requestable`/`unavailable` sind markiert
  („Available"/„Requested") und nicht wählbar. Buttons: „Request N seasons" (disabled bei 0
  Auswahl) und „Cancel". Fokus-Keys row-scoped (`season-pick-{n}`), TV-tauglich.
- Filme requesten unverändert direkt ohne Overlay.
- Overlay-Fehler (Quota, 403): Seerr-Fehlermeldung erscheint im Overlay, Overlay bleibt offen.

### Such-Screen

- Neuer Screen `search` im Navigation-Store (zustand, `push({ name: 'search' })`).
- Erreichbar über fokussierbaren „Search"-Button in einer neuen Home-Header-Zeile
  (vor dem Hero; Fokus-Reihenfolge: Header → Hero → Rows).
- Aufbau: Texteingabe oben (autofokussiert auf Web; TV nutzt natives On-Screen-Keyboard),
  darunter Ergebnis-Grid aus bestehenden `MediaPosterButton`s (row-scoped focus keys).
- Query: `GET /api/search?q=` via react-query, Key `['search', query]`, debounced ~400 ms,
  nicht ausgeführt bei leerem/1-Zeichen-Query. Leerzustand: Hinweistext; keine Treffer:
  „No results for “{query}”".
- Ergebnis-Klick → bestehender `detail`-Screen (tmdb-basiert); von dort Request wie gehabt.

### Requests-Screen + Home-Kurzliste

- Neuer Screen `requests` im Navigation-Store, erreichbar über „Requests"-Button in der
  Home-Header-Zeile.
- Liste aller eigenen Requests: Titel, Typ, `StatusBadge` (RequestStatus-Farben analog
  Availability-Badges), Staffel-Info („Seasons 1, 3") bei TV, Datum, „Cancel"-Button wenn
  `canCancel`.
- Cancel-Mutation: `DELETE /api/requests/:id`; bei Erfolg Invalidierung von `['requests']`,
  `['home']`, `['media']`, `['search']`; bei Fehler Fehlermeldung inline an der Zeile.
- Home-Kurzliste (bestehende `RequestList`-Position) zeigt die **letzten 3** Requests mit
  `StatusBadge` + „View all"-Link zum Requests-Screen. Beide Ansichten nutzen dieselbe
  `['requests']`-Query (ein Fetch).

### Availability-Polish

- `MediaPosterButton` zeigt Availability als `StatusBadge` (Pill) statt Text in der Meta-Zeile.
- `partiallyAvailable` erhält überall das Label „Partially available"; das Request-Button-Label
  im `DetailPanel` unterscheidet `available` („Available in Jellyfin") von `partiallyAvailable`
  („Partially available — request more" bei TV, öffnet den SeasonRequestPicker; bei Filmen bleibt
  partiallyAvailable praktisch irrelevant).
- `DetailPanel.canRequest` erweitert: TV mit `partiallyAvailable` ist requestbar (fehlende
  Staffeln), Filme unverändert.

## Fehlerbehandlung

| Fall | Verhalten |
|---|---|
| Seerr down bei `GET /api/requests` | 502 `UpstreamError` → Requests-Screen zeigt ErrorPanel + Retry; Home-Kurzliste blendet sich aus (Home lädt weiter). |
| Seerr down bei Suche | ErrorPanel im Such-Screen unterhalb des Eingabefelds; Eingabe bleibt erhalten. |
| Quota überschritten / 403 bei POST | Seerr-Message wird durchgereicht und am Button/Overlay angezeigt. |
| DELETE 403/404 (fremd/schon weg) | Inline-Fehler an der Zeile; `['requests']` wird trotzdem invalidiert (bei 404 verschwindet die Zeile). |
| Jellyfin-401-Kaskade | unverändert (bestehender onUnauthorized-Pfad über BFF-Calls). |

## Tests

- **API-Integration** (fastify.inject + undici MockAgent, bestehende Helpers):
  `GET /api/requests`-Mapping (inkl. Status-Mapping-Tabelle komplett), `POST` mit/ohne
  `seasons` (Payload-Assertion `seasons: [1,3]` vs `'all'`; `seasons` bei movie → 400),
  echter Initial-Status aus Seerr-Response, `DELETE` Erfolg + 403-Durchreichung,
  Media-Detail mit Staffel-Availability, Migrations-Test (Tabelle weg, Alt-DB startet sauber).
- **Frontend:** Store-Tests für `search`/`requests`-Screens; Hook-Test für Cancel-Invalidierung
  (react-query, gemockter api-client); SeasonRequestPicker-Auswahllogik als reine
  Komponenten-/Logiktests (Auswahl-Toggle, disabled-Staffeln, „All seasons").
- Bestehende Gates: `pnpm test && pnpm typecheck && pnpm lint` + web/tv-Builds.

## Offene Punkte / Backlog

- Quota-Anzeige („N remaining", Seerr `GET /api/v1/user/{id}/quota`) — späterer Slice.
- Request-Filter/-Sortierung im Requests-Screen (heute: neueste zuerst, take=50, keine Pagination).
- Webhooks für Live-Statusupdates (Slice 6) ersetzen dann das Invalidieren-bei-Aktion.
- `mapSeerrAvailability`-Wert 6 (`unavailable`) bleibt für Abwärtskompatibilität erhalten.
