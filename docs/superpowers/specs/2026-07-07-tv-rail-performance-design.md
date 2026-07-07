# Lolarr: TV-Rail-Performance — Design

**Datum:** 2026-07-07
**Status:** Entwurf (User-Review ausstehend)

## Ziel

Die Rail-Navigation auf dem Samsung S94C (Tizen, Chromium M120) wird flüssig —
in allen drei berichteten Jank-Situationen: Morph-Animation der fokussierten
Karte, schnelles D-Pad-Rattern, horizontales Rail-Nachscrollen. Harte
Nebenbedingung: **null visueller Verlust.** Card-Morph (240 px Portrait →
640 px Landscape), Frosted Glass, Fokus-Glow und Poster→Backdrop-Crossfade
bleiben visuell identisch — nur die Technik darunter darf sich ändern
(User-Entscheid: „Effekt gleich, Technik egal").

## Problemdiagnose (statische Analyse)

Alle drei Symptome haben einen gemeinsamen Kern plus Verstärker:

1. **`width`-Transition als Morph** — `.lolarr-card-slot { transition: width 400ms }`
   (`packages/ui/src/theme.css`, Slot 240 px → `--card-w-expanded` 640 px).
   Eine animierte Layout-Property relayoutet die gesamte Rail auf jedem
   Animation-Frame; alle Nachbarkarten verschieben sich per Reflow, nicht per
   Compositor. Betrifft Morph **und** Scroll (Scrollposition ändert sich
   während des Layout-Umbruchs).
2. **DOM-Scan pro Tastendruck** — `railNavigation.ts` ruft bei jedem
   Pfeil-Keydown `document.querySelectorAll('[data-focus-key]')` bzw.
   `[data-rail]` auf und sucht linear (O(n) über alle gemounteten Karten).
   Rails sind nicht virtualisiert (`MediaRail.tsx` mountet alle Items), die
   Kosten skalieren mit der Bibliotheksgröße.
3. **Norigin ohne Drosselung** — `initSpatialNavigation({ throttle: 0 })`
   (`apps/tv/src/spatial-navigation.ts`): bei gehaltener Taste rechnet die
   Spatial-Nav-Engine (inkl. interner `getBoundingClientRect`-Messungen) auf
   jedem Key-Repeat.
4. **Kein Containment** — weder `contain` noch `content-visibility` im Repo;
   Offscreen-Rails nehmen an jedem Layout/Paint teil.

Bereits vorhandene Gegenmaßnahmen (React Compiler, `loading="lazy"`,
Hover-Gating per `data-nav-input`, `smooth: false` auf TV) bleiben unberührt.

## Entscheidungen

| Frage | Entscheidung | Begründung |
|---|---|---|
| Symptomfokus | Nur Rail-Navigation | User-Angabe; Startzeit/Player-Overlays explizit raus |
| Visual-Constraint | Effekt pixelgleich, Technik frei | User-Entscheid |
| Ansatz | **Gestuft: Phase 1 Quick-Wins → Messgate → Phase 2 Morph-Compositing** | Kleines Risiko zuerst, teurer Umbau nur bei nachgewiesenem Restbedarf |
| Virtualisierung | **Nicht** in diesem Slice | Lohnt erst bei langen Rails; strukturelles Risiko dokumentiert, eigener Folge-Slice falls nötig |
| Browser-Floor | Tizen 9.0 / M120 (wie Slice 7) | `content-visibility`, `contain`, `clip-path`-Transitions voll verfügbar |

## Phase 1 — Quick-Wins (Architektur unangetastet)

### 1.1 Key-Repeat-Gating der Transitions

Bei gehaltener oder schnell wiederholter Pfeiltaste (Abstand < ~250 ms oder
`event.repeat`) setzt die Modality-Schicht (`focusScroll.ts` /
`installModalityTracking`-Umfeld) `data-nav-fast` auf `:root`. CSS schaltet
darunter die teuren Transitions ab (Card-Morph `width`, Fokus-Glow
`box-shadow`, Crossfade-`opacity`): Karten snappen sofort in den Zielzustand.
~200 ms nach dem letzten Tastendruck fällt das Attribut weg — die
Morph-Animation läuft nur, wenn der Fokus zur Ruhe kommt. Das ist das
Netflix-Verhalten: schnelles Rattern wirkt dadurch responsiver, nicht ärmer.
Kein visueller Verlust im Ruhezustand.

### 1.2 Query-Cache in `railNavigation.ts`

Rail- und Karten-Lookups werden gecacht (Map `focusKey → Element`,
`railElement → Kartenliste`) statt pro Keydown neu per `querySelectorAll`
gescannt. Invalidierung über einen `MutationObserver` auf dem
Screen-Container (childList, subtree) — jede DOM-Änderung wirft den Cache weg,
der nächste Keydown baut ihn lazy neu. Verhalten identisch, nur amortisiert.

### 1.3 Norigin-Throttle

`throttle: 0` → moderater Wert (Startwert ~100 ms, on-device kalibrieren).
Zusammen mit 1.1 bleibt gehaltenes Rattern flüssig, aber die
Spatial-Nav-Geometrie wird nicht mehr pro Key-Repeat-Frame neu vermessen.

### 1.4 CSS-Containment

- `contain: layout style` auf Karten-Slots: Layoutänderungen innerhalb einer
  Karte (Crossfade-Layer, Badges) bleiben in der Karte.
- `content-visibility: auto` + `contain-intrinsic-size` (feste Railhöhe) auf
  Rails: Offscreen-Rails kosten kein Layout/Paint/Style mehr.
  **Verifikationspflicht:** Norigin braucht Geometrie fokussierbarer Elemente —
  `contain-intrinsic-size` liefert Platzhaltergeometrie; on-device prüfen,
  dass Fokus-Sprünge zwischen Rails weiterhin korrekt landen.

### 1.5 Bilder

`decoding="async"` auf allen Rail-/Episoden-`<img>`; `fillWidth` der Poster an
die reale Slotbreite angleichen (240-px-Slot braucht keine 400-px-Anforderung;
konkreter Wert im Plan, DPR des TV-Viewports berücksichtigen). Backdrop
(1280 px für 640-px-Expanded) bleibt.

### Messgate nach Phase 1

Chrome-DevTools-Performance-Trace (Desktop, 6×-CPU-Throttle als Proxy) der
drei Szenarien Morph / Rattern / Scroll, vor und nach Phase 1, plus
On-Device-Smoke auf dem S94C. Zeigt der Morph im Ruhezustand weiterhin
sichtbaren Jank → Phase 2. Sonst endet der Slice hier (Phase 2 bleibt als
dokumentierter Folgeschritt in dieser Spec).

## Phase 2 — Morph auf den Compositor (bedingt)

Kernidee: **die Rail relayoutet nie wieder.**

1. **Fester Slot:** `.lolarr-card-slot` behält im Layout konstant 240 px —
   keine `width`-Transition mehr.
2. **Nachbarn per Transform:** Karten nach der fokussierten weichen per
   `transform: translateX(400px)` aus (Differenz expanded−collapsed). Pure
   CSS über den Folgegeschwister-Kombinator
   (`.lolarr-card-slot:has(.focused) ~ .lolarr-card-slot { … }` bzw.
   `.focused ~ .lolarr-card-slot`, je nach finaler Markup-Struktur),
   Transition auf `transform` — läuft auf dem Compositor.
3. **Aufdecken statt Aufklappen:** Die fokussierte Karte hält den
   Landscape-Inhalt (640 px, Backdrop) permanent gerendert; sichtbar wird er
   über eine animierte `clip-path: inset()`-Aufdeckung von 240 auf 640 px,
   kombiniert mit dem bestehenden Opacity-Crossfade Poster→Backdrop. Der
   expandierte Layer liegt absolut positioniert im Slot (`overflow` der Rail
   entsprechend; Details im Plan) — kein Layout, nur Paint/Compositing.
4. **Transform-Scroll:** Da visuelle Position ≠ Layout-Position, stimmt
   natives `scrollIntoView` nicht mehr. Rail-Scroll zieht auf
   `transform: translateX` am Rail-Inhalt um; Ziel-Offset wird aus
   Kartenindex × Slotbreite (+ Expanded-Korrektur) berechnet. Web behält sein
   Smooth-Gefühl über eine `transform`-Transition, TV snappt (heutiges
   `smooth: false`-Verhalten). `focusScroll.ts` bekommt dafür einen
   Rail-spezifischen Pfad; vertikales Screen-Scrolling bleibt nativ.

Phase 2 berührt `MediaRail`, `MediaPosterButton`, `theme.css` und
`focusScroll.ts` gemeinsam — Web und TV teilen den Code, beide Plattformen
werden abgenommen.

## Fehlerbehandlung

Kein neuer Fehlerpfad: alles rein visuell/klientseitig. Degradationen:

- Fällt der MutationObserver aus (Detached Container), fällt 1.2 auf
  Live-Query zurück (Cache-Miss-Pfad = heutiges Verhalten).
- `prefers-reduced-motion`-Pfade bleiben wie heute (Transitions aus).

## Tests & Verifikation

- **Unit:** Query-Cache-Invalidierung (Mutation → Cache-Rebuild),
  `data-nav-fast`-Lifecycle (setzen bei Repeat, räumen nach Idle) — jsdom.
- **Visuell:** Web-Preview-Abnahme der drei Szenarien; Screenshot-Vergleich
  Ruhezustand vor/nach (Morph-Endzustand muss identisch sein).
- **Messung:** DevTools-Trace vor/nach je Phase (dokumentiert im PR).
- **On-Device:** Smoke-Checkliste S94C (Rail-Rattern über lange Rail,
  Morph im Ruhezustand, Rail-Wechsel vertikal, Fokus-Landung nach
  `content-visibility`) — manuell, wie Slice 5.

## Out of Scope (bewusst)

- Virtualisierung/Windowing der Rails (Folge-Slice, falls Rails lang werden).
- App-Startzeit, Bundle-Splitting (IIFE-Single-Bundle bleibt), hls.js-Gewicht.
- Player-/Overlay-Performance, `backdrop-filter`-Reduktion außerhalb der Rails.
- Ältere Tizen-Engines (< M120).
