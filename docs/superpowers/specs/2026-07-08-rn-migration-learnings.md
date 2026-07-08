# Lolarr → React Native: Gesammelte Erkenntnisse (Handover für den Neustart)

**Datum:** 2026-07-08
**Zweck:** Dieses Repo wird archiviert; die RN-Migration startet als
frisches Projekt. Dieses Dokument ist der vollständige, eigenständige
Wissenstransfer — es konsolidiert die Spikes (react-lightning,
rn-lightning, rn-web, reanimated), alle 3 Entscheidungs-Gates und die
Betriebs-/Mess-Disziplin. Der Sitzungs-Ledger lag in `.git/sdd/` und
wandert NICHT mit — alles Wesentliche daraus steht hier.

**Mitgeltende Dokumente (im Archiv):**
- `2026-07-07-rn-unification-gates.md` — Gates + Ergebnisse im Detail
- `2026-07-08-rn-migration-architecture-design.md` — Ziel-Architektur (Entwurf, User-Review offen)
- `2026-07-08-yoga-upstream-issue-draft.md` — fertiger Issue-Text (nicht eingereicht)
- `2026-07-07-react-lightning-spike-design.md` — Lightning-Spike-Fazit
- `2026-07-06-lolarr-ui-redesign-abyss-cinematic-design.md` — abyss-Design-System

---

## 1. Der Beschluss

UI auf **React-Native-Primitives**, eine Codebasis. Phase 1: **Web**
(react-native-web 0.21.2) + **Samsung Tizen**
(@plextv/react-native-lightning 0.4.2). Phase 2: LG webOS (gleiche
Lightning-Schiene), Android TV/Apple TV (react-native-tvos). Alle 3
Gates bestanden (on-device bzw. real verifiziert):

| Gate | Ergebnis |
|---|---|
| 1 RN-Lightning-Perf (S94C) | settleAnim avg 17,0/p95 16,8 (Gate ≤20/≤34) — mit Yoga-Vorbehalt (s. §3) |
| 2 AVPlay-Koexistenz | Video sichtbar hinter transparentem Canvas, D-Pad bedienbar, Frame-Stats unverändert |
| 3 RN-Web-Look | abyss-Morph-Karte + Glass-Dialog (backdrop-blur) 1:1 Computed-Style-Parität |

Logik-Schicht (domain, api-client, jellyfin, player-Kern,
features-Hooks/Stores) ist **renderer-agnostisch bewiesen** — im
Neustart bei Bedarf 1:1 übernehmen statt neu schreiben. Der BFF liegt
im Archiv unter `apps/api` (Hybrid-BFF, Seerr-Proxy — siehe
Architektur-Notizen im Archiv-README/Specs).

## 2. Stack-Versionen (Peer-Lockstep!)

`@plextv/react-native-lightning` 0.4.2 erzwingt: `@lightningjs/renderer`
3.0.1, `@plextv/react-lightning*` 0.4.2, react 19.2.3, react-native
0.85.1, vite 8. Renderer 3.0.1 (statt beta20) verbesserte max-Ausreißer.
Upgrades nur im Lockstep denkbar.

## 3. Layout: der Yoga-Bug (WICHTIGSTER Vorbehalt)

Das Flexbox-Plugin korrumpiert fokus-reaktive Rows: **Row rendert
komplett leer, sobald der Fokus Index ≥ 8 von 20 erreicht** (Bisektion:
index-, nicht timing-abhängig; Plugin-Defekt, nicht App-Logik; erholt
sich erst bei Re-Mount). Konvention daraus:
- Statisches Gerüst (Spalten, Rail-Stapel, Zentrierungen): Flex ok.
- **Heißer Pfad (Kinder ändern Größe bei Fokus): absolut positionieren,
  Offsets vorberechnen.** Als benannte Primitives kapseln
  (`FlexStack` vs `AbsoluteRow`), nie ad-hoc forken.
- Yoga-Detail: überlappende Layer brauchen explizit
  `position:'absolute'` (Default ist Column-Flow).
- `useWebWorker: false` fürs Flexbox-Plugin auf Tizen (file:// kann
  keine Module-Worker laden).
- Upstream-Issue-Text liegt fertig im Archiv (nicht eingereicht).
- Konsequenz: Web (echtes Flexbox) und TV (Yoga) DIVERGIEREN in
  nicht-trivialen Layouts → Kern-Layouts pro Plattform verifizieren,
  BEVOR Screens massenhaft migriert werden.

## 4. Animations-Seam: `MotionView` (Entscheid)

Einheitliches `transition`-Prop mit CSS-Transition-Semantik; jedes
Backend fährt seinen NATIVEN Mechanismus:
- **TV:** Lightning-`transition`-Prop (Renderer-Tween) — passt durch
  RN-Komponenten durch; cubic-bezier-Strings werden nativ geparst.
- **Web:** CSS `transitionProperty/Duration/TimingFunction`.
- **Mobile (Phase 2):** Prop-Diff → Reanimated `withTiming`.
Grenzen: numerische Props + opacity (+transform später), Easing nur als
cubic-bezier-String, keine Sequenzen/Springs/Gesten im geteilten Code.

**Reanimated wurde GEMESSEN verworfen (Phase 1):**
`@plextv/react-lightning-plugin-reanimated` 0.4.2 kompiliert withTiming
zwar in Renderer-Tweens, aber der Apply-Pfad kostet on-device: settleAnim
avg 20,7–21,1/p95 33,4 vs. Baseline 16,9/16,8 (identische Video-Last, 2
konsistente Läufe + Gegenprobe nach Revert). Zusätzlich: Timing-Easing im
Plugin **hardcoded linear**; Initial-Tweens beim Mount; +22 % Bundle.
Web-seitig funktionierte echtes Reanimated 4.5.1 auf RNW einwandfrei
(Kurve exakt expo). User-Urteil on-device: „über 50 fps, aber nicht so
schön wie vorher".

## 5. Lightning-Rezepte (aus den Spikes, alle on-device verifiziert)

- **Shader registrieren:** `RenderOptions.shaders: ['Rounded',
  'RoundedWithBorder']` — sonst „ShaderType not found", borderRadius/
  Border rendern nicht. Bei border+borderRadius mappt react-lightning
  auf 'RoundedWithBorder'.
- **Fokus-Ring:** 2 verschachtelte RoundedWithBorder-Views (außen
  near-white #f5f5f7, innen dunkel #0a0a0c als Spalt), Gruppe togglet
  Opacity. borderRadius-Array-Form `[tl,tr,br,bl]` funktioniert.
- **Gradient:** `colorTop`/`colorBottom` als Lightning-Node-Props
  (nativ, billig) — kein RN-Äquivalent, bleibt raw `lng-view`.
- **Textur-Preload:** alpha 0 macht Nodes non-renderable → Textur lädt
  erst bei Fokus (sichtbarer Pop). **Epsilon-Alpha 0.004** hält Texturen
  resident. Spike hielt alle 60 Karten (~55 MB) — Produktion braucht
  Fenster (Fokus-Nachbarschaft rail±1/card±8, außerhalb alpha 0).
- **Rounded-Shader-Blitz:** malt Ladefläche hell bis Textur da —
  Mitigation: loaded-Event → alpha einblenden.
- **Fast-Nav-Gating:** parallele Crossfades beim Rattern kosten
  (19→29 ms) → bei Schnellfeuer (<~130 ms Intervall) transitions
  unterdrücken (Snap), beim Settle voller Morph. Zentral im Fokus-Store.
- **w-Tween auf lng-image streckt die Textur** (Crossfade zweier
  fix-großer Images ist die Lösung, nicht Width-Tween des Bildes).
- **Texturen laden via Web-Worker** (numImageWorkers) — Main-Frame-
  Netzwerk-Monitoring sieht sie NICHT (kein Fehlalarm!).
- **Hintergrund-Tab drosselt rAF** → Lightning-Tweens wirken eingefroren;
  Animations-/Perf-Urteile NUR im Vordergrund bzw. on-device.
- **MSDF-Fonts Pflicht** (vite-plugin-msdf-fontgen); Inter→MSDF-Pipeline
  produktiv machen (Spike lief mit Ubuntu-Testfont).
- **Tizen-Bundle:** IIFE + `inlineDynamicImports` (react-lightning nutzt
  dynamic import; file:// kann keine Chunks fetchen), target es2017,
  Font-/Asset-Pfade relativ (`./fonts/...`).

## 6. AVPlay / Video-Punch-through (Gate 2, komplett verifiziert)

- **`$WEBAPIS/webapis/webapis.js`-Script-Tag in tizen/index.html ist
  PFLICHT** — fehlte im alten Repo überall; ohne ihn existiert
  `webapis` nicht (der DOM-TV-App-Player kann so nie on-device gelaufen
  sein).
- Privileg `http://developer.samsung.com/privilege/avplay` in config.xml.
- **Punch-through-Kette:** `<object type="application/avplayer">`
  fullscreen als ERSTES body-Kind (`position:fixed`, DOM-Reihenfolge
  statt z-index) + Canvas `clearColor: 0x00000000` (Default ist
  0x000000FF opak! WebGL-Kontext hat eh alpha:true) + html/body
  `background-color: transparent` + kein opaker Root-Background im
  Scene-Graph. UI malt nur Controls — die Abstraktion ist „Loch vs.
  Element", nicht „Player vs. Player".
- Lifecycle: open → setDisplayRect(0,0,1920,1080) → setListener →
  prepareAsync → play (Muster `packages/player/src/avplayPlayer.ts` im
  Archiv). Loop/Replay: stop → open → setDisplayRect → prepareAsync →
  play. **Event-Order nicht garantiert** (onbufferingcomplete kann vor
  prepare-Success feuern).
- D-Pad (window keydown) ist völlig Canvas-/Video-unabhängig — keine
  Fokus-Sonderbehandlung nötig. Video-Decode kostete die Canvas-UI
  NICHTS (Frame-Stats identisch).
- **Fallen:** Die klassische BBB-Sample-URL
  (commondatastorage.googleapis.com/gtv-videos-bucket) liefert
  inzwischen HTTP 403 — AVPlay meldet das irreführend als
  `PLAYER_ERROR_CONNECTION_FAILED`. Testvideos LAN-hosten; der Server
  MUSS Range-Requests können (`python3 -m http.server` kann das nicht;
  Node-Server mit 206-Support schreiben).

## 7. react-native-web (Gate 3 + Mini-Spike)

- **Look trägt 1:1**: Morph-Karte (width 240→640 @400 ms expo,
  Layered-Box-Shadow-Ring, Gradient-Overlay) und Glass-Dialog
  (frost rgba(42,42,42,.72) + backdrop-filter blur(20px), radius 24,
  Shadow 0 24px 64px rgba(0,0,0,.48), Scrim rgba(0,0,0,.6)) — alle
  Computed Styles exakt, blur frostet sichtbar.
- RNW 0.21 reicht web-only-CSS-Props **untypisiert** durch
  (transition\*, boxShadow-String, backgroundImage-Gradient,
  backdropFilter, position:fixed, overflowX) → typisierten
  `webStyle()`-Seam bauen (Modul-Augmentation), nicht @ts-expect-error
  streuen.
- **Vite-Rezept für RNW (+RN-Ökosystem-Pakete):**
  - alias `react-native` → `react-native-web`
  - `.web.*`-Extensions in `resolve.extensions` UND (Vite 8/rolldown)
    in `optimizeDeps.rollupOptions.resolve.extensions` — sonst zieht
    der Optimizer native Entries (ReactFabric-Shims).
  - CJS-haltige RN-Pakete in `optimizeDeps.include` (ESM-Konversion).
  - `define`: `'process.env.NODE_ENV'`, `'process.env': '({})'`,
    `global: 'globalThis'`, `__DEV__`.
  - **Alias-Falle:** String-Aliase rewriten auch Subpfade
    (`pkg/scripts/…`) — für Paket-Swaps Regex-Exact `/^pkg$/` nutzen.
- `dataSet={{ testid: '…' }}` → `data-testid` (Test-Hooks).
- RNW-`Pressable`: `onFocus` feuert NICHT über programmatic
  `el.focus()`; Hover/echte Events nutzen. Synthetische PointerEvents
  (untrusted) erreichen RNW-Hover-Handler nicht — für Tests State
  direkt treiben.
- Mess-Falle Browser: Cursor über einer Karte kippt bei Layout-Shift
  den Hover-State (Chrome re-evaluiert Hover nach Layout) — Maus vor
  Messungen auf neutrale Fläche parken.
- Inter Variable via `@fontsource-variable/inter` (self-hosted).

## 8. CSP / tseep (Store-Risiko GELÖST, Verifikation offen)

Das `eval` im Tizen-Bundle stammt ausschließlich aus tseeps
Fast-Emitter-Codegen (`bakeCollection` in `tseep/lib/ee.js`, via
Main-Export vom Lightning-Renderer gezogen). tseep 1.3.1 liefert
API-gleiches, codegen-freies **`tseep/lib/ee-safe`**. Plan: Vite-Alias
(nur Tizen) `tseep` → `tseep/lib/ee-safe`, `unsafe-eval` aus der CSP,
wgt auf eval-Freiheit greppen, Gate-Zahlen-Lauf zur Regressions-Prüfung
(Emitter ist heißer Pfad — Erwartung: vernachlässigbar). Reanimated
brachte übrigens KEIN zusätzliches eval.

## 9. Deploy- und Mess-Disziplin (Samsung S94C)

- Gerät: 192.168.1.150:26101 (GQ77S94CATXZG), Host-Dev-PC 192.168.1.221
  (hat oft auch .151 — Beacons an beide URLs = Duplikate im Log, harmlos).
- Signier-Profil `txmazing-sc` (Zertifikate ~/SamsungCertificate/…).
- Pipeline: build → sync nach tizen/ → **Signier-Artefakte löschen**
  (author-signature.xml, signature1.xml, .manifest.tmp) → `tizen
  package -t wgt -s txmazing-sc` → **wgt IMMER per unzip verifizieren**
  (Bundle drin? webapis-Tag? kein Debug/?) → `tizen install -s <serial>`
  → `sdb shell 0 execute <appid>`.
- **Messungen NUR im Normal-Launch** — Debug-Launch verfälscht ~2×.
- **Kaltstart-Läufe verwerfen:** nach TV-Boot ist der erste Lauf
  pathologisch (idle-Bucket prüfen: n≈180/avg 16,7 = valide; n=3/avg
  1083 = Müll). Immer 2 konsistente warme Läufe.
- `sdb shell 0 kill` failt auf dem TV; `execute` foregroundet nur eine
  laufende Instanz (KEIN Reload) — frischer Start via Reinstall.
- sdb-Server-Bind (Port 26099) braucht Sandbox-Ausnahme.
- Mess-Infra: In-App-Probe (rAF-Frame-Deltas, synthetische Keydowns)
  beacont per fetch/no-cors an Host-Listener :9099 (JSONL). Muster im
  Archiv: `apps/tv-lightning/src/probe.ts` + `report.ts`.
- App-Ids: Spike `lgtSpike01.tvlightning`, DOM-App `aNw7se2Ek4.tizen`.

## 10. abyss-Design-Referenz (Kurzform; Quelle: packages/ui/src/theme.css)

- Farben: bg #0a0a0c, fg #f5f5f7, surface rgb(255 255 255/.04/.07/.11),
  dialog-frost rgb(42 42 42/.72), dialog-border rgb(245 245 247/.16).
- Radii: sm 8 / md 12 (Karten) / lg 24 (Dialog). Blur: overlay 20px,
  controls 8px. Easing: ease-out-expo cubic-bezier(0.16,1,0.3,1),
  snappy cubic-bezier(0.4,0,0.2,1).
- Morph-Karte: Slot 240×360 → NUR width auf 640 @400 ms expo (Höhe
  fix); Ring = Box-Shadow-Schichten `inset 0 0 3px rgb(200 200 200/.35),
  0 0 0 3px #0a0a0c, 0 0 0 5px #f5f5f7` @300 ms; Poster↔Backdrop-
  Crossfade 400 ms; Overlay-Gradient to top rgba(0,0,0,.85)→.4→0,
  p16/pt48; Hover-Intent 200 ms Dwell nur für Pointer.
- Dialog: maxWidth 512, p20, gap16, Shadow 0 24px 64px rgba(0,0,0,.48),
  Open fade+zoom .95 @~150 ms. Font: Inter Variable 400/500/600.
- TV-Frost: Lightning hat kein backdrop-blur; Blur-Shader teuer →
  Default dunkles opakes Panel (finale Optik = User-Entscheid).

## 11. Offene Entscheide beim Neustart

1. Yoga-Upstream-Issue einreichen (Text fertig; um Reanimated-Plugin-
   Befunde erweiterbar: easing-Hardcode, Apply-Kosten).
2. TV-Frost-Fallback (opak-dunkel empfohlen vs. Blur-Shader-Messung).
3. Expo vs. pures Vite-Setup (Empfehlung: kein Expo in Phase 1 — beide
   Targets sind Vite-Web-Builds, Lightning ERFORDERT Vite-Plugin; Expo
   erst für Phase-2-Mobile als eigene App im Monorepo evaluieren;
   react-native-tvos hat eingeschränkten Expo-Support).
4. DOM-Apps: mit Archivierung erledigt (bleiben im Archiv lauffähig).
5. tseep-ee-safe-Verifikationslauf (Slice 0).

## 12. Was aus dem Archiv wiederverwendbar ist

- `apps/api` — der BFF (explizit behalten).
- `packages/domain`, `api-client`, `jellyfin`, `player` (Interface +
  AVPlay/hls-Implementierungen), `features`-Hooks/Stores — renderer-
  agnostisch bewiesen, bei Bedarf 1:1 kopieren.
- `packages/ui/src/theme.css` — Design-Token-Quelle.
- `apps/tv-lightning` — komplette funktionierende Referenz: Tizen-Build-
  Config, Probe/Beacon-Infra, AVPlay-Punch-through, Fokus-Store, Card
  mit allen Lightning-Rezepten. Reanimated-Variante in Commit a4976ee.
- `apps/rn-web-spike` — RNW-Vite-Rezept + Gate-3-Referenz (CSS-Variante:
  Commit 7cb4f93; HEAD = Reanimated-Web-Variante, funktionierend).
