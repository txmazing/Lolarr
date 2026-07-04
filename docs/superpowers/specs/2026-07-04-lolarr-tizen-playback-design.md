# Lolarr Slice 5: Tizen-TV-Playback — Design-Spec

**Datum:** 2026-07-04
**Status:** Entwurf (User-Review ausstehend)
**Vorgänger:** Slice 1 (Fundament + Auth), Slice 2 (Home/Browse), Slice 3 (Playback Web), Slice 4 (Requests & Availability)

## Ziel

Filme/Episoden spielen auf Samsung-Tizen-TVs über die native AVPlay-API, gesteuert per
Fernbedienung. Die gesamte Session-Orchestrierung (Source-Wahl, Progress-Reporting,
Transcode-Retry, Autoplay-Next) aus Slice 3 wird wiederverwendet — nur der Player selbst
und das DeviceProfile werden plattformspezifisch injiziert.

## Nicht-Ziele

- Keine Untertitel oder Audiospur-Auswahl (eigener späterer Slice, plattformübergreifend — Moonfins komplexester Teil).
- Kein automatisiertes `.wgt`-Packaging/Signing in der CI (braucht On-Device-Zertifikate).
- Keine Scrubber-Fokus-Navigation per D-Pad (Steuerung läuft über Media-Keys/Pfeile).
- Kein HDR-Reset-Hack (Moonfin-spezifisch für ihren HTML5-Fallback, im reinen AVPlay-Pfad nicht nötig).
- Kein Suspend/Restore über `webapis.avplay.suspend()` — stattdessen simpel via `visibilitychange` (Moonfin-Muster).

## Referenz

AVPlay-Verhalten und DeviceProfile-Aufbau orientieren sich am **echten Quellcode** von
`Moonfin-Client/Smart-TV` (geklont, verifiziert) — übernommen werden API-/Geräte-Fakten und
Muster, nicht Code. Alles wird gegen das bestehende `Player`-Interface neu geschrieben.
Nicht bestätigte Behauptungen (4-GB-Limit, mkv-Untertitel-Korruption) fanden sich weder in
Moonfins Code noch in den Samsung-Docs und bleiben aus dem Design heraus.

## Architektur

### Injection-Naht: `PlayerPlatform`

Heute ist `WebPlayer` in `usePlaybackSession` hartkodiert und ein `videoRef:
RefObject<HTMLVideoElement>` durch drei Dateien gefädelt (inkl. Volume-Bypass am Interface
vorbei). Slice 5 ersetzt das durch ein injiziertes Plattform-Objekt — dasselbe Muster wie
`TvAction`/`TvTextInput`.

```ts
// packages/player/src/types.ts
export type PlayerHost = { container: HTMLElement; token: string; serverUrl: string }
export type PlayerPlatform = {
  createPlayer(host: PlayerHost): Player
  buildDeviceProfile(): DeviceProfile
  supportsVolume: boolean
  registerMediaKeys?(): () => void   // Tizen-only; gibt Unregister zurück
}
```

- `apps/web` liefert `webPlatform` (`packages/player`): `createPlayer` erzeugt ein `<video>`
  im `container` und konstruiert `WebPlayer` darüber; `buildDeviceProfile` = bestehendes
  `buildDeviceProfile()`; `supportsVolume: true`; kein `registerMediaKeys`.
- `apps/tv` liefert `tizenPlatform` (`packages/player`): `createPlayer` = `AVPlayPlayer`;
  `buildDeviceProfile` = `buildTizenDeviceProfile()`; `supportsVolume: false`;
  `registerMediaKeys` registriert die Media-Keys.
- Prop-Fluss: `LolarrApp` (neue Prop `playerPlatform`, Default `webPlatform`) →
  `AuthenticatedExperience` → `PlayerScreen` → `usePlaybackSession`.
- **Player besitzt sein DOM-Element.** WebPlayer erzeugt jetzt das `<video>` selbst (statt es
  per Ref übergeben zu bekommen) und hängt es in `container`; AVPlayPlayer das `<object>`.
  `PlayerScreen` rendert nur noch `<div ref={containerRef} className="player-surface" />`.
- **`videoRef`-Durchfädelung entfällt.** Lautstärke läuft über `Player.setVolume`; der
  Volume-Slider in `PlayerControls` wird bei `supportsVolume === false` ausgeblendet (neue
  Prop `showVolume`).

### AVPlayPlayer (`packages/player/src/avplayPlayer.ts`)

`class AVPlayPlayer implements Player`, konstruiert mit `PlayerHost`.

- **Setup:** erzeugt `<object type="application/avplayer">`, hängt es in `host.container`,
  `webapis.avplay.setDisplayRect(0, 0, 1920, 1080)` (feste Referenzauflösung, unabhängig von
  der Panel-Auflösung).
- **`load(source, { startSeconds })`:** `open(url)` → `setListener(...)` → bei
  `source.kind === 'hls'`: `setStreamingProperty('USER_AGENT', 'Lolarr/0.1.0')` mit
  `'USERAGENT'`-Fallback → `prepareAsync(ok, err)` in `Promise.race` gegen 60-s-Timeout →
  `play()`. Bei `startSeconds > 0`: direct → sofort nach `prepare` per `seekTo`; hls →
  ~1500 ms nach `play()` (AVPlay wirft sonst `PLAYER_ERROR_SEEK_FAILED` auf frischen
  HLS-Transcodes).
- **`play()`:** `getState()` PAUSED oder READY → `webapis.avplay.play()`.
- **`pause()`:** `webapis.avplay.pause()`.
- **`seek(seconds)`:** `avplaySeek(seconds * 1000)` — Retry-Loop ≤ 8×, 120 ms Delay, fängt
  `INVALID_STATE`/`InvalidState`.
- **`setVolume()`:** No-op (AVPlay hat kein Volume-API).
- **`getPosition()`:** `getCurrentTime() / 1000`; **`getDuration()`:** `getDuration() / 1000`
  (Interface arbeitet in Sekunden; ms/Ticks-Umrechnung bleibt in `createPlaybackSession`).
- **`isPaused()`:** `getState() === 'PAUSED'`.
- **Events:** eigenes `setInterval(500)` pollt `getState()` + `getCurrentTime()` → emittiert
  `timeupdate` (Moonfin no-opt `oncurrentplaytime`, weil unzuverlässig). Callbacks:
  `onstreamcompleted` → `ended`; `onbufferingstart` → `waiting`; `onbufferingcomplete` →
  `playing`; `onerror`/`onerrormsg` → `error` (unterdrückt, wenn zuvor absichtlich
  pausiert/gestoppt); Play/Pause-Zustandswechsel im Poll → `playing`/`pause`.
- **`dispose()`:** Interval clear, `stop()` (wenn nicht IDLE/NONE) → `close()`, Listener
  entfernen, `<object>` aus dem DOM lösen.
- **`webapis` wird nie statisch importiert** — Ambient-Typdeklaration in
  `packages/player/src/tizen.d.ts` (`declare global { const webapis: …; const tizen: … }`).
  Tests treiben den Player mit einem gestubbten globalen `webapis` (wie hls.js/MediaSource in
  Slice 3).

### Tizen-DeviceProfile (`packages/player/src/tizenDeviceProfile.ts`)

`buildTizenDeviceProfile(): DeviceProfile` mit Versions-Detection (reine, testbare Helper):

- **Tizen-Version bestimmen (3 Stufen):** (1)
  `tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version')`; (2) Fallback
  Samsung-Modelljahr aus dem Buchstabencode im Modellnamen (z. B. `R`→2019, `T`→2020, …
  `D`→2024); (3) Fallback Firmware-Jahr. Ergebnis: ein numerisches Jahr.
- **Codec-Tabelle nach Jahr:** DirectPlay-Container `mp4,m4v,ts,mkv,mov,avi` (+ separates
  `webm`-Profil); Video `h264` immer, `hevc` nur in `mp4/mkv/ts`, `vp9`/`av1` ab
  entsprechenden Jahren; Audio `aac,mp3,flac,vorbis,pcm,ac3,eac3` (+ `opus`, + `truehd`
  bedingt). **DTS/DCA immer ausgeschlossen** (auf jedem Tizen-Jahr unsupported → Transcode
  erzwingen).
- **Name:** `'Lolarr Tizen'`; Struktur ansonsten analog zum Web-Profil (DirectPlayProfiles +
  ein HLS-TranscodingProfile).

### Remote-Keys

- **`tizenPlatform.registerMediaKeys()`:** `tizen.tvinputdevice.registerKey` für
  `MediaPlay, MediaPause, MediaPlayPause, MediaStop, MediaRewind, MediaFastForward` — jeweils
  nur, wenn der Name in `getSupportedKeys()` vorkommt. Rückgabe: Unregister-Funktion (ruft
  `unregisterKey` für alle registrierten). Wird beim Mount des PlayerScreen aufgerufen (falls
  `registerMediaKeys` vorhanden), beim Unmount die Unregister-Funktion.
- **PlayerScreen-`keydown` erweitert (additiv zu Space/Pfeile/F/Escape aus Slice 3):**

  | Keycode | Aktion |
  |---|---|
  | 415 (MediaPlay) | play |
  | 19 (MediaPause) | pause |
  | 10252 (MediaPlayPause) | togglePause |
  | 413 (MediaStop) | onExit |
  | 412 (MediaRewind) | seekBy(-10) |
  | 417 (MediaFastForward) | seekBy(10) |
  | 10009 (Back) | Controls sichtbar → ausblenden; sonst onExit |

  Ein Handler für beide Plattformen; die Web-Keys bleiben unverändert.

### Packaging & config.xml

- `apps/tv/tizen/config.xml`: Privileges ergänzen — `http://developer.samsung.com/privilege/avplay`,
  `http://tizen.org/privilege/tv.inputdevice`, `http://developer.samsung.com/privilege/productinfo`,
  `http://tizen.org/privilege/systeminfo`, `http://tizen.org/privilege/tv.audio`,
  `http://tizen.org/privilege/network.public` (zusätzlich zum bestehenden `internet` +
  `application.launch`).
- CSP und `tizen:allow-navigation`: hartkodierte Dev-LAN-IP (`192.168.1.221`) auf `*`
  verallgemeinern, damit beliebige Jellyfin-Server erreichbar sind.
- `tizen:sync`-Flow unverändert; kein `.wgt`-Signing in diesem Slice.

## Fehlerbehandlung

| Fall | Verhalten |
|---|---|
| AVPlay `onerror`/`onerrormsg` | `error`-Event → PlayerScreen-ErrorPanel + Back (wie Slice 3). |
| `prepareAsync`-Timeout (60 s) | `error`-Event → ErrorPanel. |
| Direct-Play-Fehler | bestehender Ein-Mal-Transcode-Retry in `createPlaybackSession` greift plattformübergreifend. |
| Seek während Buffering | Retry-Loop im AVPlayPlayer (≤ 8×), fängt `INVALID_STATE`. |
| `registerKey` auf alter Firmware | per `getSupportedKeys()`-Guard übersprungen, kein Crash. |
| App im Hintergrund (`visibilitychange` hidden) | Player pausiert; sichtbar → wenn zuvor spielend, fortsetzen. (Im AVPlayPlayer gekapselt.) |

## Tests

- **`packages/player/tests/avplayPlayer.test.ts`** (gestubbtes globales `webapis`, fake
  timers): Lifecycle `open→setListener→prepareAsync→play`; 500-ms-Polling emittiert
  `timeupdate` mit korrekter Sekunden-Position; Seek-Retry bei `INVALID_STATE`; HLS setzt
  `USER_AGENT`; HLS-Resume-Seek verzögert; `onstreamcompleted`→`ended`, `onerror`→`error`
  (und Unterdrückung nach Pause); `dispose` ruft stop/close/Element-removal.
- **`packages/player/tests/tizenDeviceProfile.test.ts`** (gestubbtes `tizen.systeminfo`):
  jede Detection-Stufe (platform.version, Modelljahr-Buchstabe, Firmware-Fallback); Codec-Tabelle
  pro Jahr; DTS-Ausschluss; hevc-Container-Gating.
- **`packages/player/tests/platforms.test.ts`:** `webPlatform`/`tizenPlatform`-Factories —
  `createPlayer` hängt das richtige Element in einen Test-`container`, `supportsVolume`-Flag,
  `registerMediaKeys` nur bei tizen.
- **Frontend:** Store/Screen-Test für die `playerPlatform`-Prop-Durchreichung; Test, dass
  `PlayerControls` den Volume-Slider bei `showVolume={false}` weglässt.
- **On-Device-Verifikation bleibt manuell** (kein Tizen-Emulator in der CI) — im
  Task-Abschluss dokumentiert.
- Bestehende Gates: `pnpm test && pnpm typecheck && pnpm lint` + web/tv-Builds.

## Offene Punkte / Backlog

- Untertitel + Audiospur-Auswahl (eigener plattformübergreifender Slice).
- Automatisiertes `.wgt`-Build/Signing + On-Device-Smoke in einer Pipeline.
- Scrubber-Fokus per D-Pad (norigin-fokussierbarer Seekbar-Ersatz).
- Modelljahr-Buchstabentabelle vervollständigen/pflegen, wenn neue Samsung-Serien erscheinen.
- 4-GB-/mkv-Untertitel-Quirks verifizieren, falls sie in der Praxis auftreten.
