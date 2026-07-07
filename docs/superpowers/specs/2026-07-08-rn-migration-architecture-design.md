# RN-Migrations-Architektur — Phase 1: Web + Tizen

**Datum:** 2026-07-08
**Status:** Entwurf — wartet auf User-Review (autonome Session; offene
Entscheide unten explizit markiert)
**Grundlage:** Alle 3 Gates aus
[2026-07-07-rn-unification-gates.md](2026-07-07-rn-unification-gates.md)
durchlaufen (G1 Zahlen ✓ mit Yoga-Vorbehalt; G2 Telemetrie ✓, User-Blick
offen; G3 ✓). Lightning-Lehren aus
[2026-07-07-react-lightning-spike-design.md](2026-07-07-react-lightning-spike-design.md).

## Ziel & Rahmen

Eine UI-Codebasis auf React-Native-Primitives für Web
(`react-native-web` 0.21.2) und Samsung Tizen
(`@plextv/react-native-lightning` 0.4.2, Renderer 3.0.1, Vite 8,
React 19.2.3 — Peer-Lockstep aus Gate 1). Die Logik-Schicht bleibt
unverändert: `domain`, `api-client`, `jellyfin`, `player`(-Interface),
`features`-Hooks/-Stores sind renderer-agnostisch bewiesen. Die DOM-Apps
(`apps/web`, `apps/tv`) laufen bis zur Ablösung weiter
(Roadmap-Entscheid 2026-07-08). Phase 2 (webOS, Android TV, Apple TV)
ist bewusst außerhalb dieses Dokuments.

## 1. Monorepo-Struktur

**Entscheidung:** Ein neues Design-System-Package + zwei dünne App-Shells:

```
packages/ui-rn        # RN-Primitives-Design-System (Tokens, Card, Rail,
                      # GlassPanel, Focusable, Layout-Helper, Text-Stile)
apps/rn-web           # Shell: Vite + Alias react-native→react-native-web
apps/rn-tv            # Shell: NativeCanvas/RenderOptions + Tizen-Build
                      # (Muster: apps/tv-lightning inkl. vite.tizen.config)
```

Screens/Flows bleiben in `packages/features` (Hooks/Stores unverändert;
die Screen-Komponenten werden dort auf RN-Primitives neu geschrieben und
ersetzen die DOM-JSX-Variante erst bei Ablösung — bis dahin koexistieren
`HomeScreen.tsx` (DOM) und `HomeScreen.rn.tsx`). DI-Seams
(`WebAction`/`WebShell`/`WebTextInput`-Muster) bestehen weiter und
bekommen RN-Implementierungen pro Shell.

**Verworfen:** (a) Ein einziges `apps/rn` mit Dual-Build — TV braucht
eigenen Entry (NativeCanvas, keyMap, clearColor, Probe) und eigenes
Deploy; zwei Shells spiegeln das bestehende web/tv-Muster und halten
moon/launch.json trivial. (b) `packages/ui` in-place migrieren — bricht
die laufenden DOM-Apps.

**Bleibt:** domain, api-client, jellyfin, player, features. **Neu:**
ui-rn, rn-web, rn-tv. **Ausläufer (bis Ablösung eingefroren, nur
Bugfixes):** ui, web, tv. **Spikes (nach Merge archivieren/löschen):**
tv-lightning, rn-web-spike.

## 2. Layout-Konvention (Yoga-Bug)

Gate-1-Defekt: das Yoga-Flexbox-Plugin korrumpiert fokus-reaktive Rows
(Row rendert leer ab Fokus-Index ≥ 8 von 20; per Bisektion
index-abhängig, Plugin-Defekt). Konsequenz als **benannte Konvention**
statt Ad-hoc-Forks:

- **Statisches Gerüst** (Seiten-Spalten, Rail-Stapel, Dialog-Zentrierung,
  Paddings) DARF Flex nutzen — auf beiden Plattformen.
- **Heißer Pfad** (alles, dessen Kinder auf Fokus die Größe ändern —
  konkret: die Karten-Row) MUSS absolut positioniert werden, Offsets
  vorberechnet (Spike-Muster `Rail.tsx`).
- `ui-rn` kapselt das als zwei Primitives: `<FlexStack>` (Yoga ok) und
  `<AbsoluteRow>` (vorberechnete x-Offsets, fokus-reaktiv). Screens
  wählen das Primitive, nie rohe Style-Forks.
- Jedes neue Layout-Primitive bekommt einen On-Device-Smoke
  (Probe-Szenario) BEVOR es breit verwendet wird (Gates-Doc-Mandat).

**Upstream-Issue** an plexinc/react-lightning: Entwurf liegt in
[2026-07-08-yoga-upstream-issue-draft.md](2026-07-08-yoga-upstream-issue-draft.md)
— **Einreichen = User-Entscheid** (öffentliche Aktion). Bis zur
Upstream-Antwort gilt die Konvention unabhängig davon.

## 3. Design-System-Übersetzung abyss → RN

- **`packages/ui-rn/src/tokens.ts`** als Single Source: Farben, Radii
  (8/12/24), Blur (20/8), Easings (`ease-out-expo`, `ease-snappy`),
  Dauern (400/370/300/150 ms), Spacing. Werte manuell aus
  `packages/ui/src/theme.css` gespiegelt (kleines Set; Codegen wäre
  Overkill — Drift-Check als Unit-Test, der theme.css parst und
  vergleicht).
- **Zwei Style-Ebenen:**
  1. RN-safe geteilt: Farben, Radii, Spacing, Typo — identische
     Style-Objekte für beide Backends.
  2. Showpiece-Ebene pro Plattform (Gate-3-Befund: RNW reicht
     web-only-Props untypisiert durch; Lightning hat sie gar nicht):
     - Web: typisierter **`webStyle()`-Helper** (Modul-Augmentation) für
       transition\*, boxShadow-String, backgroundImage-Gradient,
       backdropFilter, position:fixed, overflowX.
     - TV: Lightning-Äquivalente — natives `transition`-Prop,
       colorTop/colorBottom-Gradient, Shader-Registrierung
       `['Rounded','RoundedWithBorder']`, Fokus-Ring als 2 verschachtelte
       Border-Views, Fast-Nav-Snap (Spike-Task-7-Lehren).
- **Reanimated (geprüft 2026-07-08): nicht in Phase 1.** Web würde gehen
  (offizieller RNW-Support; Worklets laufen dort als normale
  JS-Funktionen auf dem Main-Thread, Babel-Plugin oder explizite
  Dependency-Arrays). TV geht NICHT: @plextv/react-native-lightning 0.4.2
  hat weder Animated-Export noch Reanimated-Anbindung, Reanimateds
  Web-Pfad schreibt in DOM-`element.style` (existiert bei Lightning
  nicht), und selbst ein Shim wäre per-Frame-JS — exakt der Kostenpfad,
  den die Spike-Messungen auf dem S94C falsifiziert haben. Der bewiesene
  60fps-Pfad bleibt der renderer-seitige Tween (transition-Prop). Der
  Animation-Seam (Intent-Tokens → Web-CSS-Transition / TV-transition-
  Prop) ist so geschnitten, dass Reanimated in Phase 2 für
  react-native-tvos (nativ, echte Worklets) als drittes Backend
  einklinken kann.
- **Frost auf TV:** kein backdrop-blur in Lightning; Blur-Shader sind
  teuer (DOM-Messung + Gates-Doc). **Default: dunkleres opakes Panel**
  (frost-Farbe mit höherem Alpha, z. B. rgb(28 28 30 / 0.96)) —
  **finale Optik = User-Entscheid** (Alternative: Blur-Shader-Versuch
  mit Perf-Messung in Slice 2).
- **Fonts:** Web Inter Variable via fontsource (Gate 3 ✓); TV
  Inter→MSDF-Pipeline produktiv machen (bisher Ubuntu-Testfont) — Task
  in Slice 0.

## 4. Fokus-Engine

Deterministischer zustand-Store (Spike-Muster `store.ts`):
`railIndex` + per-Rail-`cardIndex`-Gedächtnis, Forward-Snake am
Rail-Ende. Kein Norigin auf der RN-Seite.

- `packages/ui-rn/src/focus/`: Store + `useDpad`-Hook (window-keydown,
  plattformneutral — Gate 2 bewies: völlig Canvas-/Video-unabhängig) +
  `keyMap` (Tizen-Codes inkl. 10009 Back).
- Fokus-Visualisierung ist abgeleiteter Prop (`focused`), nie
  DOM-Fokus — identisches Verhalten Browser/TV, testbar ohne DOM.
- Web zusätzlich: Hover setzt denselben Store (Modalitäts-Gate wie im
  Web-Arrow-Nav-Slice: Pointer vs. Keyboard getrennt behandeln).
- Media-Keys (Play/Pause etc.): `tizen.tvinputdevice.registerKey` erst
  im Player-Slice.

## 5. Player-Abstraktion pro Backend

`packages/player` Interface bleibt. Pro Shell:

- **Web:** bestehender hls.js/`<video>`-Player unverändert.
- **TV (AVPlay, Gate-2-Muster):** `<object type="application/avplayer">`
  fullscreen als erstes body-Kind (position:fixed, DOM-Reihenfolge statt
  z-index); Canvas `clearColor: 0x00000000`; PlayerScreen malt über dem
  Video nur Controls (Root transparent). Pflicht-Zutaten:
  `$WEBAPIS/webapis/webapis.js`-Tag in tizen/index.html + avplay-Privileg
  (fehlten repo-weit — in apps/tv als separater Bugfix geflaggt).
  Lifecycle exakt wie `avplayPlayer.ts`; Event-Order nicht garantiert
  (onbufferingcomplete vor prepare-Success beobachtet).
- UI-seitig ein `PlayerSurface`-Slot in ui-rn: Web rendert `<video>`
  hinein, TV rendert NICHTS (transparentes Loch) — die Abstraktion ist
  „Loch vs. Element", nicht „Player vs. Player".

## 6. Fast-Nav-Gating (Snap beim Rattern)

Zentral im Fokus-Store: Keydown-Timestamps; Intervall < ~130 ms ⇒
`fastNav=true`, nach ~200 ms Ruhe zurück. Konsumenten (Card, Rail)
unterdrücken bei fastNav ihre transition-Props (Web: transition none;
TV: transition-Prop weglassen) → Snap; Settle-Fokus bekommt den vollen
Morph/Crossfade. Begründung: Spike maß Rattern 19→29 ms durch parallele
Crossfades; DOM-App nutzt dasselbe Konzept (`data-nav-fast`) erfolgreich.
Schwellwerte als Tokens, on-device kalibrieren (Slice 1).

## 7. Textur-Preload-Fenster

Spike hält alle 60 Karten resident (Epsilon-Alpha 0.004, ~55 MB).
Migration: **Fenster statt Alles** — Texturen resident nur für
Fokus-Nachbarschaft (aktive Rail ± 1 Rail, Karten `cardIndex ± 8`),
außerhalb alpha 0 (Renderer evictet). Implementierung als Hook
`useTextureWindow(railIndex, cardIndex)` in ui-rn, der pro Karte
`resident: boolean` liefert; Karte mappt das auf Epsilon-Alpha.
Budget-Ziel ≤ ~60 MB; Messung über Renderer-Stats im Slice-1-Probe-Lauf.
Poster-Blitz-Mitigation (Rounded-Shader malt Ladefläche hell):
loaded-Event → alpha einblenden (Spike-Lehre).

## 8. unsafe-eval-CSP (tseep) — NEUER BEFUND

Das `eval` im Tizen-Bundle stammt aus tseeps Fast-Emitter-Codegen
(`bakeCollection`, `tseep/lib/ee.js`), den der Renderer über den
tseep-Main-Export zieht. tseep 1.3.1 liefert einen **API-gleichen
CSP-safe-Emitter `tseep/lib/ee-safe`** mit. Plan:

1. Vite-Alias (nur Tizen-Build): `tseep` → `tseep/lib/ee-safe`.
2. `unsafe-eval` aus der CSP entfernen; wgt per unzip auf eval-Freiheit
   greppen.
3. Gate-Zahlen-Lauf wiederholen (Emitter ist heißer Pfad — Regression
   ausschließen; Erwartung: vernachlässigbar).
4. Nur falls Regression: unsafe-eval behalten und Store-Review-Risiko
   bewusst tragen (dokumentiert).

Damit ist das Samsung-Store-Risiko voraussichtlich vollständig
auflösbar statt nur „zu klären".

## 9. Slice-Schnitt

| Slice | Inhalt | Exit-Kriterium |
|---|---|---|
| 0 Fundament | ui-rn (tokens, webStyle-Seam, FlexStack/AbsoluteRow, Focus-Store), Shells rn-web/rn-tv, Tizen-Build+Deploy-Script (wgt-unzip-Check), MSDF-Inter, tseep-ee-safe-Alias | „Hello-Rail" läuft im Browser UND auf S94C (Normal-Launch), CSP ohne unsafe-eval |
| 1 Home | Rails + Morph-Card + Hero (light), Fast-Nav-Gating, Textur-Fenster | Gate-Zahlen halten (avg ≤ 20/p95 ≤ 34) on-device; Browser-Parität per Computed-Styles gegen theme.css |
| 2 Detail + Dialog | DetailScreen, GlassDialog (Web frost/Blur; TV Fallback-Panel), SeasonRequestPicker | Look-Abnahme Web+TV; Frost-Entscheid TV umgesetzt |
| 3 Player | Web hls.js; TV AVPlay-Punch-through, Controls-Overlay, Media-Keys | Playback + Controls on-device (Gate-2-Muster), Resume/Seek |
| 4 Rest + Ablösung | Search, Login, Settings; Paritäts-Checkliste gegen DOM-Apps | User-Abnahme; DOM-Apps archivieren |

Jeder Slice: Spec → Plan → On-Device-Verify (Normal-Launch-Regel, Probe-
Infra aus den Spikes). Keine Massen-Screen-Migration vor Slice-1-Exit
(Kern-Layout-Beweis, Gates-Doc-Mandat).

## Teststrategie

- Unit: Fokus-Store (Snake/Memory), Token-Drift-Test gegen theme.css,
  Layout-Helper.
- Browser: Computed-Style-Paritätschecks (Preview-Tooling, Muster
  Gate 3) + Screenshots.
- On-Device: Probe-Szenarien (Frame-Stats, Gate-Kriterium) pro Slice;
  wgt-Inhalt IMMER per unzip verifizieren; Messung nur Normal-Launch.
- Player: Beacon-Telemetrie-Muster aus Gate 2 für AVPlay-Zustände.

## Offene User-Entscheide

1. **Yoga-Upstream-Issue einreichen?** Text liegt bereit (öffentliche
   Aktion, dein GitHub-Account).
2. **TV-Frost-Fallback:** dunkles opakes Panel (empfohlen) vs.
   Blur-Shader-Versuch mit Perf-Messung.
3. **Naming** `apps/rn-web`/`apps/rn-tv` + `packages/ui-rn` ok?
4. **DOM-Apps während Migration:** eingefroren (nur Bugfixes, empfohlen)
   oder weiterentwickeln?
5. ~~**Gate-2-Restabnahme**~~ — erledigt 2026-07-08: Video auf dem S94C
   sichtbar, Gate 2 formal geschlossen.
