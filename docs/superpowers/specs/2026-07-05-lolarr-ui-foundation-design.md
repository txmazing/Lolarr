# Lolarr Slice 7: UI-Foundation & Screen-Rework — Design

**Datum:** 2026-07-05
**Status:** Entwurf (User-Review ausstehend)

## Ziel

Lolarr bekommt eine neue visuelle Identität nach dem Vorbild von abyss-jellyfin
(monochrom, Frosted Glass, striktes Radius-/Easing-System) auf Basis von
shadcn/ui + Tailwind v4 — und **alle 9 Screens** werden in diesem Slice auf den
neuen Look gebracht. Web und TV (Samsung Tizen) werden gleichrangig abgenommen.

## Entscheidungen

| Frage | Entscheidung | Begründung |
|---|---|---|
| Scope | Foundation + Rework **aller** Screens | User-Entscheid („Alles anpassen/reworken!") |
| TV-Anspruch | TV von Anfang an, jede Welle auf Gerät abgenommen | Geteiltes `packages/ui`, Lib-Wahl ist TV-Wette |
| Browser-Floor | **Tizen 9.0 / Chromium M120** als Basis | S94C (2023) erhält via One-UI-Tizen-Programm OS-Upgrades inkl. Web-Engine (Tizen 8.0 → M108, Tizen 9.0 → M120). Workarounds für ältere Engines sind bewusst **nicht** Teil dieses Slices |
| Komponenten-Strategie | **shadcn/ui überall** (auch im geteilten Pfad) | User-Entscheid nach Recherche; Risiko wird über Phase-0-Gate kontrolliert |
| Farbrichtung | **Abyss-monochrom pur** | Fast-weißer Akzent, 2-3 Farb-Tokens, kein Gelb mehr |
| shadcn-Updates | Generierte Dateien bleiben **pristine** unter `packages/ui/src/components/ui/shadcn/`; Anpassungen nur in Wrappern | `npx shadcn add --overwrite` bleibt jederzeit möglich |
| Dark Mode | Dark-only, kein Light-Theme | Netflix-Logik |

### Recherche-Grundlage (Kurzfassung)

- **abyss-jellyfin** ist ein CSS-Theme für Jellyfin-Web (MIT), kein Client.
  Übertragbar sind die Prinzipien: monochrome Mini-Palette, konsequentes
  `backdrop-filter`-Glass, ein Radius-/Easing-System statt Ad-hoc-Werten.
- **reiverr** (Svelte, AGPL) nutzt keine Komponenten-Lib; übernommene Muster:
  Spotlight-Hero, Fokus-Zoom auf Karten, Stack-Overlays für Details.
- **Bits UI** ist Svelte-only → für React unbrauchbar.
- **Radix/Base UI auf TV** ist undokumentiertes Terrain; der Fokus-Konflikt
  (Focus-Traps vs. Norigin-Spatial-Navigation) ist das Kernrisiko dieses
  Slices und wird in Phase 0 empirisch entschieden.
- **Tizen-Engines:** ausgeliefert je Baujahr (2023 = M94), aber One-UI-Tizen-
  Updates heben die Engine an (Tizen 9.0 = M120). Quelle:
  developer.samsung.com → Web Engine Specifications.

## Phase 0 — Gate (vor jedem Screen-Umbau)

1. **UA-Verifikation:** Die TV-App loggt `navigator.userAgent` +
   `tizen.systeminfo`-Version. Ergebnis wird als Notiz in dieser Spec
   ergänzt. Erwartung: Chromium M120 auf dem S94C (GQ77S94C, Tizen 9).
2. **Norigin×Base-UI-Spike:** Minimaler Testscreen (hinter Dev-Flag) mit
   shadcn-`Dialog` in Glass-Optik + drei Norigin-fokussierbaren Buttons,
   deployed auf den S94C. Erfolgskriterien:
   - D-Pad-Select auf dem Trigger öffnet den Dialog.
   - Pfeiltasten steuern den Fokus **innerhalb** des offenen Dialogs.
   - Zurück-Taste schließt; Fokus kehrt zum Trigger zurück.
   - Glass-Dialog rendert flüssig (kein sichtbares Ruckeln beim Öffnen).
3. **Plan B bei Spike-Fehlschlag:** shadcn bleibt für alle nicht-
   fokusfangenden Komponenten (Button, Input, Tabs, Badge, Skeleton);
   Overlays (Dialog/Dropdown) werden als schlanke Eigenbau-Varianten im
   geteilten Pfad gebaut. Kein Strategie-Neustart.

## Architektur

- **Tailwind v4** via `@tailwindcss/vite` in `apps/web` und `apps/tv`.
  CSS-Entry je App: `@import "tailwindcss";` + `@source "../../packages/ui/src";`
  (Pfad je App korrekt relativ) + Import der geteilten Theme-Datei.
- **Tokens** leben in `packages/ui/src/theme.css` im `@theme`-Block.
  Das bestehende `packages/ui/src/styles.css` wird wellenweise abgelöst
  (BEM-Klassen raus, sobald der zugehörige Screen reworked ist) und am Ende
  gelöscht.
- **shadcn:** `components.json` in `packages/ui`, Aliase zeigen auf
  `src/components/ui/shadcn/`. Generierte Dateien werden **nie** editiert.
  Lolarr-Wrapper liegen in `src/components/ui/` (z. B. `Button.tsx` wrappt
  `shadcn/button.tsx` mit Lolarr-Varianten). Screens/Features importieren
  ausschließlich Wrapper.
- **DI-Muster unangetastet:** `ActionComponent`/`TextInputComponent`/
  `ShellProps`-Slots bleiben; `apps/tv` injiziert weiter `TvAction`/
  `TvTextInput`/`TvShell` mit Norigin-Fokus-Hoheit. shadcn liefert Styling
  und Primitives innerhalb dieser Architektur.
- **Änderungs-Disziplin:** API-/Verhaltens-Änderungen an Komponenten sind
  erlaubt, wenn UI/UX es verlangt — jede Änderung wird im Task-Report
  dokumentiert und Konsumenten + Tests werden im selben Task angepasst.

## Design-Tokens

| Token | Wert | Zweck |
|---|---|---|
| `--background` | `#0a0a0c` | App-Grund |
| `--surface` | `rgb(255 255 255 / 0.04)` | Cards, Panels |
| `--surface-2` | `rgb(255 255 255 / 0.07)` | Hover/erhöhte Flächen |
| `--surface-3` | `rgb(255 255 255 / 0.11)` | aktive Flächen |
| `--foreground` | `#f5f5f7` | Primärtext & Akzent |
| `--muted-foreground` | `#a1a1a6` | Sekundärtext |
| `--border` | `rgb(255 255 255 / 0.10)` | Hairlines |
| `--glass` | `rgb(42 42 42 / 0.60)` | Glass-Flächen-Tint |
| `--blur-overlay` | `15px` | Dialoge, Overlays |
| `--blur-controls` | `4px` | Player-Leiste, schwebende Controls |
| `--radius-sm / --radius / --radius-lg` | `8px / 12px / 24px` (+ Pill via `9999px`) | einzige erlaubte Radii |
| `--ease` | `cubic-bezier(0.16, 1, 0.3, 1)` | Standard-Easing |
| `--ease-snappy` | `cubic-bezier(0.4, 0, 0.2, 1)` | Micro-Interactions |
| `--duration` | `0.35s` | Standard-Dauer |

**Semantische Status-Tokens** (entsättigt, Startwerte — Feintuning erlaubt):
`--status-available: #6fbf9f`, `--status-processing: #8fa8c9`,
`--status-pending: #c9b37e`, `--status-declined: #c98181`,
`--status-failed: #c98181`, `--status-requested: #a393c9`,
`--danger: #d97b7b`.

**Primär-Button:** gefülltes Fast-Weiß (`--foreground`) mit Text `#0a0a0c`.
**Typografie:** Inter (Variable Font, self-hosted in `packages/ui`), 5-stufige
Skala. TV hebt die Root-Font-Size an (Startwert 150 %, Feintuning auf Gerät);
alle Größen in `rem`.
**Fokus:** Web `:focus-visible`-Ring (1px `--foreground` + Offset); TV
Karten-Zoom `scale(1.06)` + aufgehellter Rand über geteilte `focused`-Klasse.
**Glass-Kill-Switch:** Fällt Glass auf TV durch (Performance), wird
`--glass` auf eine solide Fläche umgestellt — ein Token-Diff, kein Umbau.

## Komponenten-Mapping

**shadcn-basiert (immer via Wrapper):**

| Bestand | shadcn-Unterbau | Hinweis |
|---|---|---|
| `DefaultAction` | `Button` | Varianten: primary (weiß), ghost, glass |
| `DefaultTextInput`, `SearchBar` | `Input` | |
| `SeasonRequestPicker`, `AutoplayOverlay` | `Dialog` | Glass; Spike-abhängig (Plan B: Eigenbau-Overlay) |
| `SeasonSelector` | `Tabs` | Pill-Form |
| `StatusBadge`, `RequestStatusBadge` | `Badge` | Status-Tokens |
| `LoadingPanel` | `Skeleton` | Shimmer statt Spinner |

**Bleiben eigen, restyled:** `HeroPanel`, `MediaRail`, `MediaPosterButton`,
`DetailPanel`, `EpisodeList`, `PlayerControls` (inkl. eigenem D-Pad-tauglichem
Progress-Slider), `RequestList`, `AppFrame`, `GatewayPanel`, `LoginPanel`,
`QuickConnectPanel`, `ToastStack` (kein sonner — bestehende Poll-Logik und
TV-Tauglichkeit bleiben).

`TvAction`/`TvTextInput`/`TvShell` in `apps/tv` bleiben Norigin-Träger und
rendern dieselben Wrapper-Styles.

## Screen-Rework (alle 9, in 4 Wellen)

| Welle | Screens | Rework |
|---|---|---|
| ① | Gateway, Login, QuickConnect | Zentrierte Glass-Card, weißer Primär-Button, QC-Code groß & monospaced |
| ② | Home, Detail | Spotlight-Hero (Backdrop, Gradient-Scrim, Fortschritt bei „Weiterschauen"), Rails mit Fokus-Zoom, Skeletons; Detail: Backdrop-Hero, Glass-Info-Panel, Staffel-Tabs, Request-Dialog |
| ③ | Search, LibraryDetail, Requests | Ergebnis-/Poster-Grid auf Token-Basis, Badge-Status, klarere Zeilen-Hierarchie |
| ④ | Player, ToastStack, AppFrame | Glass-Control-Leiste, D-Pad-Progress-Slider, Autoplay-Glass-Dialog, Glass-Toasts, Nav-Restyling |

Jede Welle wird auf Web (Preview) **und** TV (S94C) abgenommen, bevor die
nächste startet. Wellen ②-④ dürfen erst nach bestandenem Phase-0-Gate
beginnen.

## Risiken & Gegenmittel

| Risiko | Gegenmittel |
|---|---|
| shadcn-Primitives-Fokus (Base UI) × Norigin kollidiert | Phase-0-Spike als Gate; Plan B definiert (Eigenbau-Overlays) |
| Glass zu teuer für TV-GPU | Kill-Switch-Token; Spike testet Glass explizit |
| M120-Wette platzt (Engine-Downgrade/Zweitgerät) | Floor dokumentiert; Workarounds als bewusster Folge-Slice |
| Regression über 9 Screens | Wellen-Abnahme; Verhaltens-Änderungen erlaubt, aber dokumentiert + Konsumenten/Tests im selben Task angepasst |
| Tailwind-Scan übersieht `packages/ui` | `@source`-Direktiven in beiden Apps; Wave-①-Abnahme prüft beide Builds |

## Tests

- Bestehende `packages/ui`-Vitest-Suiten bleiben grün; wo eine
  UX-Änderung Verhalten ändert, wird der Test im selben Task angepasst
  und die Änderung im Task-Report dokumentiert.
- Neue Tests: Button-Varianten, Dialog open/close/focus-return,
  Tabs-Wechsel, Badge-Status-Mapping, Skeleton-Rendering.
- Pro Welle: Web-Preview-Verifikation + TV-Smoke auf dem S94C.
- README-Smoke-Checklist wird erweitert: UA-Log-Schritt, „Glass sichtbar
  & flüssig", Fokus-Zoom auf Rails.

## Nicht im Scope

- Workarounds für Engines < M120 (bewusster Folge-Slice bei Bedarf)
- Light-Mode
- sonner/Toast-Ersatz (ToastStack bleibt)
- Untertitel-/Audiospur-Auswahl im Player (weiter aufgeschoben aus Slice 5)
- Drizzle-Adoption (eigener Foundation-Slice, unverändert)

## Nachtrag 2026-07-05: shadcn-Primitives = Base UI

shadcn defaultet seit Juli 2026 auf Base UI als Primitives-Schicht
(`components.json`-`style: base-nova`; Radix bliebe via `radix-*` wählbar).
User-Entscheid: **Base UI** — deckt sich mit der Lib-Recherche (aktivste
Entwicklung, Radix-Nachfolgeteam). Alle „Radix"-Bezüge in Spec/Plan meinen
fortan die shadcn-Primitives-Schicht (Base UI); das Phase-0-Gate testet den
Fokus-Konflikt unverändert.

## Phase-0-Ergebnis (2026-07-05, On-Device S94C, Tizen 9)

**UA:** Chrome/120 bestätigt → M120-Floor stimmt.
**Buttons + Pill-Tabs:** D-Pad voll funktionsfähig → shadcn-Button/Input/Badge/
Skeleton + das Action-basierte PillTabs-Muster sind TV-tauglich.
**Glass:** rendert flüssig → kein Kill-Switch nötig, Blur bleibt.
**Dialog (Erstversuch, modal):** Buttons im Dialog per D-Pad NICHT auswählbar —
Base UIs modaler Focus-Trap + `inert` desynchronisiert Norigin.

**Auflösung (statt Plan B / Eigenbau-Overlay):** `GlassDialog` rendert Base UI
nun **non-modal** (`Dialog.Root modal={false}` + `Popup initialFocus={false}`,
Commit `cd23aa3`) — Base UI setzt keinen Trap/`inert` mehr und zieht den Fokus
nicht an sich, Norigin behält die Hoheit. Escape/Backdrop-Schließen bleiben.
Kein Eigenbau-Overlay, shadcn-Datei unangetastet. **Re-Spike auf dem S94C
ausstehend**, bevor Wellen ②-④ die Dialoge nutzen.
