# Lolarr Slice 3: Playback Web — Design

Datum: 2026-07-03 · Status: entworfen, wartet auf Review · Baut auf Slice 1 (Auth) + Slice 2 (Home/Browse) auf

## Kontext

Slice 2 lieferte Home mit Bibliotheks-Rows und den LibraryDetailScreen mit disabled ▶. Dieser Slice macht den ▶ lebendig: Video-Playback im Browser, direkt Client→Jellyfin (Architektur-Grundsatz: Medien-Traffic nie durchs BFF). Der Client besitzt seit Slice 1 die Jellyfin-Session (`lolarr.jellyfin`: url, accessToken, userId, deviceId) — sie wurde genau hierfür an den Client gegeben. Referenz-Muster: Wholphin (PlaybackInfo-Flow, Progress-Listener) und Moonfin (DirectPlay→Transcode-Retry).

## Produktentscheidungen (geklärt)

1. **Einstiege:** ▶ im LibraryDetail (Film + jede Episodenzeile) UND Weiterschauen-Kachel/Hero starten direkt den Player (nur continue-watching-Row + Hero; alle anderen Kacheln öffnen weiterhin das Detail).
2. **Player-UI:** Custom Basis-Controls — Play/Pause, Seek-Bar mit Zeitanzeige, ±10s-Skip, Lautstärke, Fullscreen, Zurück, Titelanzeige; Auto-Hide nach 3 s; Tastatur (Space, ←/→, F, Esc). Kein Track-/Qualitätsmenü (Folge-Slice).
3. **Resume:** automatisch an letzter Position (`resumePositionTicks`); im Detail sekundärer „Start from beginning"-Button, wenn Fortschritt existiert. Kein Dialog.
4. **Autoplay-Next:** am Episodenende Overlay „Next episode in 10s" mit Countdown + Cancel; nächste Folge via `/Shows/NextUp?seriesId=…`.
5. **Architektur:** Client-direkt (Ansatz A) — PlaybackInfo, Streams und Progress-Reporting laufen ohne BFF; das DeviceProfile entsteht zwingend im Browser (`MediaSource.isTypeSupported`).

## Ziel & Erfolgskriterium

1. Film abspielen: LibraryDetail → ▶ → Video läuft (DirectPlay wenn möglich, sonst HLS-Transcode), Resume an letzter Position.
2. Episode abspielen: Episodenzeile → ▶; am Ende Autoplay-Overlay → nächste Folge ohne Screen-Wechsel.
3. Weiterschauen-Kachel/Hero → Player direkt.
4. Fortschritt landet in Jellyfin (Start/Progress alle 10 s/Stopped) — die Weiterschauen-Row aktualisiert sich beim nächsten Home-Load; `['home']` wird beim Verlassen des Players invalidiert.
5. Transcode-Sessions werden beim Stop/Verlassen beendet (`DELETE /Videos/ActiveEncodings`).
6. Unit-Tests für DeviceProfile-Builder, Source-Wahl, ProgressReporter, Retry-Logik, URL-/Payload-Bau grün.

## packages/jellyfin — Playback-Erweiterung

Alle Funktionen nehmen `JellyfinSession` (nutzt `session.deviceId` — die Geräte-Id des Clients, nicht `lolarr-gateway`):

```ts
export type PlaybackInfoResult = {
  playSessionId: string
  mediaSources: MediaSourceInfo[]   // schlanker eigener Typ: id, container?, supportsDirectPlay, supportsDirectStream, transcodingUrl?, etag?
}
export async function getPlaybackInfo(session, itemId, opts: {
  deviceProfile: unknown            // von packages/player gebaut; opak durchgereicht
  startTimeTicks?: number
  maxStreamingBitrate?: number
  enableDirectPlay?: boolean        // false beim Transcode-Retry
}): Promise<PlaybackInfoResult>     // POST /Items/{id}/PlaybackInfo?userId=…, Header-Auth

export type StreamSource = { url: string; kind: 'direct' | 'hls' }
export function buildStreamSource(session, itemId, source: MediaSourceInfo, playSessionId): StreamSource
// direct:  {url}/Videos/{itemId}/stream.{container}?Static=true&mediaSourceId=…&deviceId=…&api_key={token}&Tag={etag}&playSessionId=…
// hls:     {url}{transcodingUrl}  (Jellyfin liefert relative URL inkl. api_key)

export async function reportPlaybackStart(session, info: PlaybackProgressInfo): Promise<void>    // POST /Sessions/Playing
export async function reportPlaybackProgress(session, info): Promise<void>                        // POST /Sessions/Playing/Progress
export async function reportPlaybackStopped(session, info): Promise<void>                         // POST /Sessions/Playing/Stopped
// PlaybackProgressInfo: { itemId, mediaSourceId, playSessionId, positionTicks, isPaused, playMethod: 'DirectPlay' | 'Transcode' }
export function buildStoppedBeaconPayload(session, info): { url: string; body: string } | null    // für navigator.sendBeacon (api_key als Query, da Beacon keine Header kann)

export async function stopActiveEncodings(session, playSessionId): Promise<void>  // DELETE /Videos/ActiveEncodings?deviceId=…&playSessionId=…
export async function getNextUpEpisode(session, seriesId): Promise<{ itemId: string; title: string; seasonNumber?: number; episodeNumber?: number } | null>
// GET /Shows/NextUp?seriesId=…&userId=…&limit=1
```

Fehler: non-ok → geworfener Error mit Status (Package bleibt BFF-frei, kein UpstreamError-Import; eigene schlanke `JellyfinRequestError { status }`). 401 wird vom Aufrufer (features) über den bestehenden onUnauthorized-Pfad behandelt: der Player-Hook fängt `status === 401` und ruft den Session-Cleanup.

## packages/player (neu)

Plattformneutrale Orchestrierung + Web-Implementierung; einzige Deps: `@lolarr/jellyfin`, `@lolarr/domain`, `hls.js`.

- `buildDeviceProfile(): DeviceProfile` — aus `MediaSource.isTypeSupported`-Probes: Video h264/hevc/vp9/av1, Audio aac/mp3/ac3/eac3/opus/flac, Container mp4/webm/mkv (DirectPlay), TranscodingProfile HLS/fMP4 (h264+aac Fallback). Struktur an jellyfin-webs Profil orientiert, bewusst schlank. In Nicht-Browser-Umgebung (kein `MediaSource`): konservatives h264/aac-Profil (testbar in Node).
- `Player`-Interface:
```ts
export type PlayerEvent = 'timeupdate' | 'ended' | 'error' | 'waiting' | 'playing' | 'pause'
export interface Player {
  load(source: StreamSource, opts: { startSeconds?: number }): Promise<void>
  play(): void
  pause(): void
  seek(seconds: number): void
  setVolume(volume: number): void   // 0..1
  getPosition(): number             // seconds
  getDuration(): number             // seconds, NaN wenn unbekannt
  on(event: PlayerEvent, handler: (detail?: unknown) => void): () => void
  dispose(): void
}
```
- `WebPlayer implements Player`: bekommt ein `HTMLVideoElement`; `kind:'hls'` → hls.js (`Hls.isSupported()`; Safari: natives HLS via src); `kind:'direct'` → `video.src`. dispose räumt hls.js + Listener.
- `PlaybackSession` (UI-frei, Herzstück):
```ts
export type PlaybackSessionState = 'loading' | 'playing' | 'paused' | 'ended' | 'error'
export function createPlaybackSession(deps: {
  session: JellyfinSession
  player: Player
  itemId: string
  resumeTicks?: number
  onStateChange(state: PlaybackSessionState, detail?: { message?: string }): void
}): { start(): Promise<void>; togglePause(): void; seekBy(seconds: number): void; seekTo(seconds: number): void; stop(): Promise<void>; getProgress(): { position: number; duration: number } }
```
  Ablauf von `start()`: `buildDeviceProfile` → `getPlaybackInfo` (mit `startTimeTicks: resumeTicks`) → erste MediaSource mit `supportsDirectPlay`, sonst erste mit `transcodingUrl` → `buildStreamSource` → `player.load({ startSeconds: resumeTicks/10_000_000 })` → `reportPlaybackStart`. Kein DirectPlay UND keine transcodingUrl → Fehlerzustand.
  **Retry-Regel:** Feuert der Player ein `error`-Event, während eine `kind:'direct'`-Quelle lädt/spielt, genau EIN erneuter Durchlauf mit `enableDirectPlay:false`; scheitert auch der → `state:'error'`.
  **ProgressReporter** (intern): Progress alle 10 s (Timer) + sofort bei Pause/Resume/Seek; Ticks = Sekunden × 10_000_000; `playMethod` gemäß Quelle. `stop()`: Timer aus, `reportPlaybackStopped`, bei hls-Quelle `stopActiveEncodings`. Unload-Schutz: `pagehide`-Listener mit `navigator.sendBeacon(buildStoppedBeaconPayload(...))`.

## Frontend (features/ui)

- **Domain/BFF-Mini-Erweiterung (einzige Server-Änderung):** `jellyfin`-Unterobjekt + `resumePositionTicks?: number` (aus `UserData.PlaybackPositionTicks`) und `seriesId?: string` (aus `SeriesId`); `episodeSchema` + `resumePositionTicks?: number`. Mapping in `apps/api/src/adapters/jellyfinLibrary.ts` (drei Zeilen + Raw-Typ-Felder). Bestehende Tests um die neuen Felder ergänzt.
- Navigation: `Screen`-Union + `{ name: 'player'; itemId: string; resumeTicks?: number; seriesId?: string }`. PlayerScreen bekommt `key={itemId}` (Autoplay-Next pusht player→player — Remount nötig, Lehre aus S2).
- Einstiege:
  - `LibraryDetailScreen`: ▶ aktiviert (`resumeTicks` aus `item.jellyfin.resumePositionTicks`); bei Fortschritt zusätzlich „Start from beginning" (startet mit `resumeTicks: undefined` → Position 0). Episodenzeilen: `EpisodeList` bekommt `onPlay(episode)`-Callback + Play-Action pro Zeile (Episode → `resumePositionTicks` der Episode).
  - `HomeScreen`/`experience.tsx`: Klick auf Item der `continue-watching`-Row oder Hero mit `item.jellyfin` → `push({ name:'player', itemId: item.jellyfin.itemId, resumeTicks: item.jellyfin.resumePositionTicks, seriesId: item.jellyfin.seriesId })`; alle anderen Rows unverändert Detail. (Weiche in `onOpenItem` per Row-Kontext: `MediaRail`/`HeroPanel` melden die Row-Id mit — `onOpen(item)` wird zu `onOpen(item, context: { rowId?: string; isHero?: boolean })`, UI-Komponenten reichen nur durch.)
- `PlayerScreen` (features/player/): Fullscreen (`.player-screen`), `<video>`-Element + `usePlaybackSession`-Hook (kapselt createPlaybackSession, liest `readJellyfinSession(storage)`; Session fehlt → ErrorPanel). Controls-Overlay: Auto-Hide 3 s (Mousemove/Keydown zeigt wieder), Play/Pause, Seek-Bar (Klick + Drag), Zeit `mm:ss / hh:mm:ss`, ±10s, Lautstärke-Slider, Fullscreen-Toggle (`requestFullscreen` auf Screen-Container), Back (stop + pop). Tastatur: Space=Pause, ←/→=±10s, F=Fullscreen, Esc=Back.
- Autoplay-Next: bei `state:'ended'` und vorhandener `seriesId` → `getNextUpEpisode`; Treffer → `AutoplayOverlay` (Countdown 10→0, „Play now" / „Cancel"); Ablauf/Play → `replace`-Navigation auf neuen Player (Screen-Store erhält `replace(screen)`-Methode: Stack-Top ersetzen); Cancel/kein Treffer → `pop()`.
- Verlassen des Players (Back/Ende ohne Next): `stop()` abwarten (fire-and-forget mit Fehler-Log), `queryClient.invalidateQueries({ queryKey: ['home'] })`, `pop()`.
- ui-Komponenten (dumm): `PlayerControls` (Props: state, position, duration, volume, callbacks, visible), `AutoplayOverlay` (title, secondsLeft, onPlayNow, onCancel, Action). `EpisodeList` erhält optionales `onPlay`/`Action`-Paar (abwärtskompatibel: ohne `onPlay` wie bisher ohne Buttons).

## Fehlerbehandlung

| Fall | Verhalten |
|---|---|
| PlaybackInfo scheitert / keine abspielbare MediaSource | `state:'error'` → ErrorPanel im PlayerScreen + Back |
| DirectPlay-`error`-Event | genau 1 Retry mit `enableDirectPlay:false`; danach ErrorPanel |
| hls.js fatal error | dispose + `state:'error'` |
| Jellyfin 401 bei Playback-Calls | Player stoppen, bestehenden onUnauthorized-/Session-Cleanup-Pfad auslösen → Login |
| `lolarr.jellyfin` fehlt/invalid | PlayerScreen zeigt ErrorPanel („Session missing — please sign in again") |
| Tab-Close/Navigation weg | `pagehide` → sendBeacon Stopped (best effort) |
| Progress-POST scheitert einzeln | still weiterspielen, warn-log, nächster Tick versucht erneut |

## Testing

Units `packages/player` (vitest, jsdom nicht nötig — Player/DOM gemockt):
1. `buildDeviceProfile`: mit gemocktem `MediaSource.isTypeSupported` (verschiedene Antwortmuster) + Node-Fallback-Profil
2. Source-Wahl: DirectPlay bevorzugt; ohne DirectPlay → transcodingUrl; weder noch → error
3. ProgressReporter: fake timers — Start sofort, Progress bei 10 s/Pause/Seek, Stopped + stopActiveEncodings (nur bei hls) bei stop()
4. Retry: direct-`error` → zweiter getPlaybackInfo-Call mit `enableDirectPlay:false`; zweiter Fehler → `state:'error'`; hls-`error` → kein Retry
5. Ticks↔Sekunden-Konvertierung

Units `packages/jellyfin`: URL-/Payload-Bau aller neuen Funktionen (Stream-URL mit api_key/Static/Tag, PlaybackInfo-Body, Progress-Payloads, Beacon-Payload, NextUp-Parsing), Fehler-Mapping (`JellyfinRequestError.status`).

API-Tests: nur Mapping-Erweiterung (resumePositionTicks/seriesId in bestehenden jellyfin-library-Tests ergänzt).

Manueller Smoke (Abschluss-Checkliste): Film DirectPlay + erzwungener Transcode, Episode mit Autoplay-Next, Resume-Round-Trip (abspielen → beenden → Weiterschauen-Row zeigt Fortschritt → Fortsetzen), Transcode-Kill im Jellyfin-Dashboard sichtbar.

## Out of Scope (Folge-Slices)

- Track-/Untertitel-/Qualitätsmenü (Folge-Slice; DeviceProfile + PlaybackInfo-Neuverhandlung vorbereitet)
- Tizen-Playback (Slice 5 — `Player`-Interface ist die Andockstelle für AVPlay)
- Requests/Availability-UI (Slice 4), Webhooks (Slice 6)
- Chromecast/SyncPlay/Trickplay-Thumbnails
