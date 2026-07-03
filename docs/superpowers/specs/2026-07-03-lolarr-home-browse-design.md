# Lolarr Slice 2: Home/Browse mit echten Jellyfin-Daten — Design

Datum: 2026-07-03 · Status: entworfen, wartet auf Review · Baut auf Slice 1 auf (`docs/superpowers/specs/2026-07-03-lolarr-foundation-auth-design.md`)

## Kontext

Slice 1 lieferte Auth (Jellyfin-Passwort + Quick Connect, Seerr-Session via Silent-QC) und die restrukturierte Codebasis. Der Home-Screen zeigt bisher nur Seerr-Discover-Rows (TMDB). Dieser Slice bringt die eigene Jellyfin-Bibliothek auf den Home-Screen und liefert das Jellyfin-Detail (inkl. Staffeln/Episoden) als Vorbereitung für Playback (Slice 3). Bilder laufen direkt Client→Jellyfin (Architektur-Entscheidung aus der Gesamtplanung: Medien-Traffic nie durchs BFF).

## Produktentscheidungen (geklärt)

1. **Home gemischt, Bibliothek zuerst:** Hero → Weiterschauen → Nächste Folgen → Neu in [Library] (pro Library) → Discover-Rows (Trending/Popular, wie bisher mit Request-Option). Eine Scroll-Fläche.
2. **Browse-Tiefe:** nur Home-Rows. Kein Library-Browse/Grid, keine Filter (späterer Slice).
3. **Detail:** Jellyfin-Detail mit Staffel-/Episodenliste bei Serien. ▶-Button sichtbar, bis Slice 3 disabled.
4. **Hero:** erstes Resume-/NextUp-Item („Continue watching"); Fallback Discover-Trending, wenn nichts angefangen.
5. **Datenmodell:** Ansatz A — ein `MediaItem`-Typ mit optionalem `jellyfin`-Unterobjekt (kein Typ-Split, keine discriminated union).

## Ziel & Erfolgskriterium

Nach diesem Slice:

1. Home lädt über einen Call (`GET /api/home`) gemischte Rows aus Jellyfin (Resume/NextUp/Latest pro Library, mit User-Token) und Seerr-Discover (Admin-Key, gecacht).
2. Hero zeigt das erste Weiterschauen-Item mit Backdrop und Episode-Label; Fallback Trending.
3. Poster/Backdrops von Jellyfin-Items lädt der Client direkt vom Jellyfin-Server (`packages/jellyfin`), TMDB-Bilder wie bisher.
4. Jellyfin-Titel öffnen einen Library-Detail-Screen (Metadaten, bei Serien Staffeln + Episoden mit Gespielt-Status, disabled ▶). Discover-Titel öffnen das bestehende Seerr-Detail.
5. Resume-Kacheln zeigen einen Fortschrittsbalken.
6. Teilausfall degradiert sauber; Jellyfin-401 löst die bestehende 401-Kaskade aus.
7. API-Integrationstests + Units grün (bestehender Vitest/MockAgent-Harness).

## Domain-Erweiterung (`packages/domain`)

- `mediaItemSchema`: `tmdbId` wird **optional**; neues optionales Unterobjekt:

```ts
jellyfin?: {
  itemId: string
  imageTags: { primary?: string; backdrop?: string; thumb?: string }
  progressPercent?: number        // 0–100, nur bei Resume-Items
  episode?: { seriesTitle: string; season: number; number: number }
}
```

- Neue Schemas:
  - `homeResponseSchema = { hero?: MediaItem, rows: MediaRow[] }`
  - `libraryDetailResponseSchema = { item: MediaItem, seasons?: Season[] }`
  - `seasonSchema = { id, name, episodes: Episode[] }`
  - `episodeSchema` = schlankes Item: `{ id, jellyfinItemId, title, seasonNumber, episodeNumber, overview, runtimeMinutes?, played: boolean, imageTag? }`
- Bestehende Felder (`posterUrl`, `backdropUrl`) bleiben: Für Discover-Items liefert das BFF weiterhin TMDB-URLs; für Jellyfin-Items bleiben sie leer und der Client baut die URL aus `jellyfin.imageTags`.

## BFF (`apps/api`)

### `GET /api/home` (Session-pflichtig)

- Parallel (Promise.allSettled, row-weise):
  - Jellyfin mit **User-Token** (aus DB entschlüsselt, `getJellyfinToken`) und DeviceId `lolarr-gateway`: `GET /UserViews`, `GET /UserItems/Resume` (limit 12, mediaTypes Video), `GET /Shows/NextUp` (limit 12), `GET /Items/Latest?parentId=<viewId>` (limit 16, je Movie-/Show-Library eine Row).
  - Seerr-Discover über bestehenden Adapter (Admin-Key), **In-Memory-Cache 5 min** (user-unabhängig, ein Cache für alle).
- Komposition: `hero` = erstes Resume-Item, sonst erstes NextUp-Item, sonst erstes Trending-Item (dann ohne jellyfin-Feld). Row-Reihenfolge: `continue-watching` (Resume+NextUp gemergt, nach zuletzt gespielt sortiert — Wholphin-Muster), `latest-<library>`…, dann Discover-Rows.
- Degradation: scheitert eine Jellyfin-Teilabfrage nicht-401, wird die Row weggelassen (warn-log); scheitern alle Jellyfin-Calls, kommt ein Discover-only-Home. Seerr-Ausfall analog (Jellyfin-only-Home). Nur wenn beides scheitert → 502.
- **Jellyfin-401** (Token revoked): Adapter wirft `JellyfinTokenInvalidError(userId)` → bestehende 401-Kaskade (Sessions gelöscht, Client landet am Login).

### `GET /api/library/:itemId` (Session-pflichtig)

- `GET /Items/{id}` mit User-Token (`fields=Overview,Genres,People` minimal halten). 404, wenn Jellyfin 404 liefert.
- Bei `Type === 'Series'`: zusätzlich `/Shows/{id}/Seasons` + `/Shows/{id}/Episodes` (pro Season), gemappt auf `Season[]`/`Episode[]` inkl. `UserData.Played`.

### Jellyfin-Adapter-Erweiterung

Neue Funktionen mit einheitlichem Kontext `(config, auth: { accessToken, userId, deviceId })`: `getUserViews`, `getResumeItems`, `getNextUp`, `getLatest(viewId)`, `getItem(id)`, `getSeasons(seriesId)`, `getEpisodes(seriesId, seasonId)`. Alle nutzen den bestehenden Header-Builder; 401 → `JellyfinTokenInvalidError(userId)` (neu für User-Calls; bei Auth-Endpoints bleibt `InvalidCredentialsError`). Mapping Jellyfin-Item → `MediaItem` in einer Funktion `mapJellyfinItem` (exportiert, unit-testbar): Titel, Jahr (`ProductionYear`), Overview, `ProviderIds.Tmdb` → `tmdbId` (optional), ImageTags, `UserData.PlayedPercentage` → `progressPercent`, Episoden-Infos bei `Type === 'Episode'`. `availability: 'available'` für Bibliotheks-Items.

## packages/jellyfin (neu, Client-seitig, kein React)

- `readJellyfinSession(storage: KeyValueStorage): JellyfinSession | null` — liest `lolarr.jellyfin`, validiert mit `jellyfinSessionSchema.safeParse`; invalide/fehlende Werte → `null` (kein Crash). *(Erledigt das offene Backlog-Item „Lese-Helper mit Schema-Validierung".)*
- `buildImageUrl(session, itemId, type: 'Primary'|'Backdrop'|'Thumb', tag, opts?: { width?: number; quality?: number }): string` → `{session.url}/Items/{itemId}/Images/{type}?tag=…&fillWidth=…&format=Webp&quality=90`. Bild-GETs brauchen kein Token.
- Dependency: nur `@lolarr/domain` (Schema). Kein Import aus features: `readJellyfinSession` nimmt den Storage strukturell typisiert entgegen (`{ get(key: string): string | null }`) — features' `localStorageAdapter` erfüllt das Interface ohne Kopplung.

## Frontend (`packages/features`, `packages/ui`)

- `home/useHome.ts`: `useQuery(['home', apiBaseUrl], api.home())` ersetzt `useDiscover` im HomeScreen; Suche behält den bestehenden `/api/search`-Pfad.
- Bild-Auflösung: `resolveItemImages(item, session)` in features — `item.jellyfin` vorhanden → `buildImageUrl(...)`, sonst `posterUrl`/`backdropUrl` unverändert. Ergebnis wird als fertige URLs an die (dummen) UI-Komponenten gereicht.
- `MediaPosterButton`/`MediaRail`: optionaler `progressPercent` → schmaler Fortschrittsbalken am Kachel-Fuß; Episode-Label („S2 · E5") als Untertitel, wenn vorhanden.
- Hero: „Continue watching"-Badge, Titel bzw. `seriesTitle` + Episode-Label; Klick → Detail (wie Kachel).
- Navigation: `Screen`-Union + `{ name: 'libraryDetail', itemId: string }`. Kachel-Klick: `item.jellyfin` → libraryDetail, sonst bestehendes `detail`.
- `library/LibraryDetailScreen.tsx` + `useLibraryDetail(itemId)`: Backdrop, Metadaten, disabled ▶ („Playback kommt in Kürze"-Hint), bei Serien Staffel-Auswahl (Rail aus Season-Buttons) + Episodenliste (Nummer, Titel, Laufzeit, Gespielt-Häkchen). TV-Fokus über bestehende `Action`-Adapter.
- api-client: `home()`, `libraryDetail(itemId)`.

## Fehlerbehandlung (Zusammenfassung)

| Fall | Verhalten |
|---|---|
| Jellyfin-Teilabfrage scheitert (nicht 401) | Row fehlt, warn-log, Home lädt |
| Jellyfin komplett down | Discover-only-Home |
| Seerr down | Jellyfin-only-Home (Discover-Rows fehlen) |
| Beide down | 502 `jellyfin_unreachable` (Jellyfin ist die primäre Quelle des Home) |
| Jellyfin-401 (User-Token tot) | `JellyfinTokenInvalidError` → 401-Kaskade → Login |
| `lolarr.jellyfin` fehlt/invalid im Client | Jellyfin-Bilder fallen auf `posterUrl` (falls vorhanden) bzw. Platzhalter zurück — kein Crash |
| Library-Detail: Item unbekannt | 404 → ErrorPanel mit Back |

## Testing

Integration (bestehender MockAgent-Harness, `apps/api/tests/`):
1. Home happy path: gemischte Rows in korrekter Reihenfolge, Hero aus Resume, Continue-Watching-Merge (Resume+NextUp sortiert)
2. Hero-Fallback: kein Resume/NextUp → Trending-Hero ohne jellyfin-Feld
3. Jellyfin down → Discover-only-Home (200)
4. Seerr down → Jellyfin-only-Home (200)
5. Jellyfin-401 beim Home → 401 `session_expired` + Session serverseitig gelöscht (Kaskade)
6. Library-Detail Film (ohne seasons) und Serie (Seasons+Episodes, Played-Mapping)
7. Library-Detail 404

Units: `mapJellyfinItem` (Movie/Episode/ProviderIds/Progress), `buildImageUrl` (Param-Bau), `readJellyfinSession` (valide/invalide/fehlende Werte), Discover-Cache (TTL greift, kein Upstream-Call innerhalb 5 min).

## Out of Scope (Folge-Slices)

3. Playback Web (PlaybackInfo + DeviceProfile + hls.js + Progress-Reporting, `packages/player`) — ▶ wird hier aktiviert
4. Requests-Ausbau + Availability-Badges (Seasons-Requests, PARTIALLY_AVAILABLE-UI)
5. Playback Tizen (AVPlay)
6. Seerr-Webhooks → Notifications
- Library-Browse/Grid, Genre/Person-Filter, Watched/Favorite-Toggles, Server-DisplayPreferences-Sync.
