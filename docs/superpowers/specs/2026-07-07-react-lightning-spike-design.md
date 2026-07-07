# Lolarr: react-lightning-Spike (`apps/tv-lightning`) — Design

**Datum:** 2026-07-07
**Status:** Entwurf (User-Review ausstehend)

## Ziel

Beweisen oder widerlegen, ob ein Wechsel des TV-View-Layers auf
**react-lightning** (Plex' React-Reconciler für den Lightning-3-WebGL-Renderer)
animierte Navigation liefert, die das DOM auf dem S94C nachweislich nicht kann
— bei Erhalt des React-Logik-Stacks. Der Spike ist ein Wegwerf-Prototyp mit
Messpflicht, kein Produktionscode.

## Kontext (gemessen, 2026-07-07, S94C Normal-Launch)

- DOM: jede mehrframige CSS-Animation 25–45 ms/Frame (Property/Promotion
  egal); settled Navigation 60 fps → TV snappt seit `4de5e60`.
- Canvas-only-WebGL (App-DOM ausgeblendet, 1080p): avg 19,8 ms, max 33,4 —
  die physikalische Decke für jeden WebGL-Renderer auf diesem Gerät.
- Debug-Launch (`sdb shell 0 debug`) verfälscht ~2× → **alle Spike-Messungen
  im Normal-Launch** (In-App-Probe → HTTP-Listener, Muster existiert).

## Beweisziele & Go-Kriterium

| # | Beweis | bestanden wenn |
|---|---|---|
| 1 | Animation flüssig on-device | Fokus-Animation (Expand + Nachbarn weichen aus) läuft im Auto-Messszenario mit **avg ≤ 20 ms und p95 ≤ 34 ms** |
| 2 | React-Stack integrierbar | `@tanstack/react-query` + `zustand` laufen unverändert unter react-lightning (Row-Daten via Query, Fokus-Store) |
| 3 | D-Pad/Fokus praktikabel | Per-Rail-Fokus-Memory + Forward-Snake ohne Norigin sauber implementierbar (Lightning-Fokus-System) |

Jedes Nicht-Bestehen ist ein gültiges Spike-Ergebnis (No-Go mit Begründung),
kein Scheitern des Spikes.

## Aufbau

- **Neue Wegwerf-App `apps/tv-lightning`** (im Monorepo, aber von keiner
  bestehenden App referenziert): Vite, `@plexinc/react-lightning` +
  `@lightningjs/renderer` (Versionen gepinnt), React 19.
- **Tizen-Paketierung** nach `apps/tv`-Muster: eigenes `tizen/`-Verzeichnis,
  eigene App-ID (Koexistenz mit Lolarr auf dem TV), `vite.tizen.config`-Analog
  (IIFE-Bundle), Deploy über den etablierten Weg (tizen CLI package/install,
  Host-PC-IP 192.168.1.221). **Lehre aus heute:** nach jedem Packaging
  wgt-Inhalt per `unzip -l` verifizieren (Signatur-Reste/`Debug/`-Artefakte
  vorher löschen; Injektionen gehen beim Repacking verloren).
- **Screen:** Home-artig, 3 Rails × 20 Karten, Poster als echte Remote-Texturen
  (öffentliche TMDB-Image-URLs, Liste als Bundled-JSON — kein Auth/BFF).
  Look nur grob abyss (dunkler BG, Radius, Fokus-Ring-Analog) — Optik ist
  nicht Beweisziel.
- **Animation (Beweis 1):** fokussierte Karte expandiert per Lightning-Tween
  (Scale/Reveal ~400 ms analog zum Web-Morph), Nachbarkarten weichen per
  Position-Tween aus, Titel-Overlay blendet ein. Rail-Scroll als Tween der
  Rail-Container-Position.
- **Daten (Beweis 2):** `useQuery` mit `queryFn`, die Bundled-JSON nach
  ~300 ms simulierter Latenz liefert; ein `zustand`-Store hält Fokus-Zustand
  (Rail-Index, Karten-Index je Rail). Kein Import aus `packages/features`
  (dessen Screens sind DOM-gebunden) — es zählt, dass dieselben Libraries
  funktionieren.
- **Fokus (Beweis 3):** Lightning-Fokus-System; Pfeiltasten (Tizen sendet
  Standard-`ArrowX`-Keys) steuern: Links/Rechts in der Rail, Hoch/Runter mit
  Per-Rail-Memory, Rechts am Rail-Ende → Snake zur nächsten Rail. Back-Key
  (10009) beendet die App.
- **Messung ab Tag 1:** rAF-Frame-Recorder + Auto-Szenario 15 s nach Load
  (5× langsamer Fokuswechsel mit Animation / 12× Rattern @60 ms / 4× Rail
  hoch-runter), POST an `http://192.168.1.221:9099/report` (Listener-Script
  existiert im Scratchpad-Muster) + permanentes FPS-Overlay (min/avg der
  letzten 60 Frames als Lightning-Text).

## Fehlerbehandlung

Prototyp: Fehler dürfen sichtbar crashen. Einzige Pflicht: Textur-Ladefehler
(TMDB nicht erreichbar) → Platzhalter-Rechteck statt Crash, damit die Messung
offline lauffähig bleibt (Bundled-Fallback-Farben).

## Deliverable

1-seitiges Fazit (Abschnitt in dieser Spec, nach dem Spike ergänzt):
Messwerte je Szenario vs. Go-Kriterium, Go/No-Go je Beweisziel,
Aufwandsschätzung für einen echten View-Layer-Rewrite (Screens, Overlays,
Player-UI, Fokus-System), Reibungspunkte-Liste (erwartet: SDF-Font-Setup für
Inter, Textur-Speicher bei 90+ Postern, react-lightning-API-Lücken,
Koexistenz AVPlay `<object>` über/unter dem Canvas).

## Risiken

- **react-lightning-Reife** (Nischenprojekt; Plex' eigene TV-Strategie ist
  inzwischen React Native): Blocker in der Lib beenden den Spike als
  „No-Go: Lib-Reife" — dokumentieren, nicht workarounden (> 1 Tag Aufwand
  pro Workaround = Abbruchkriterium).
- **19,8-ms-Decke:** Auch Lightning kann die Present-Pipeline des Geräts
  nicht unterschreiten; das Go-Kriterium ist bewusst darauf kalibriert.
- **Text/Fonts:** Lightning rendert Text via SDF/Canvas-Fonts — Inter-Setup
  ist Teil des Spikes (typischer TV-Stolperstein).

## Out of Scope

Playback/AVPlay, Auth/BFF/Seerr, Web, Integration in `apps/tv`, `packages/ui`,
finales Design, Tests/CI (Wegwerf-Code; nur die Messung muss stimmen).
