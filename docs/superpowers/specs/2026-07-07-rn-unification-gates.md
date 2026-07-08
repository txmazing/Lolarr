# Lolarr: React-Native-Vereinheitlichung — Entscheidungs-Gates

**Datum:** 2026-07-07
**Status:** Beschlossen unter Vorbehalt (User-Entscheid nach react-lightning-Spike-GO)

## Beschluss

Lolarr stellt die UI auf **React-Native-Primitives** um — **wenn und nur
wenn** die drei Gates unten bestehen. Motivation: eine UI-Codebasis für Web+TV;
Mobile-Apps (RN nativ) sind erwünschter Bonus, kein Treiber. Bewusst
akzeptierte Konsequenz: die bestehende Web-UI (Slice 7 + Redesign,
DOM/Tailwind/shadcn) wird auf RN-Primitives neu gebaut. Die Logik-Schicht
(domain, api-client, jellyfin, player-Kern, features-Hooks/Stores) bleibt —
im react-lightning-Spike als renderer-agnostisch bewiesen.

**Plattform-Roadmap (User-Entscheid 2026-07-08):**

| Phase | Plattform | RN-Backend |
|---|---|---|
| 1 (Start) | Web | `react-native-web` (DOM) |
| 1 (Start) | Samsung Tizen | `@plextv/react-native-lightning` (WebGL) |
| 2 (später) | LG webOS | `@plextv/react-native-lightning` (WebGL, gleiche Web-App-Schiene) |
| 2 (später) | Android TV, Apple TV | `react-native-tvos` (nativ) |

Konsequenz aus Gate 1 für die Architektur: Layout-Konvention definieren, die
Web-Flexbox UND Tizen-Yoga-Plugin überlebt (heißer Pfad ggf. absolut
positioniert / Plugin-Bug upstream melden); Kern-Layouts pro Plattform
verifizieren, bevor Screens massenhaft migriert werden. Das Monorepo bleibt:
`apps/api` (BFF) und alle Logik-Packages sind frontend-agnostisch; die neue
RN-App entsteht daneben, die DOM-Apps laufen bis zur Ablösung weiter.

## Gates (alle on-device bzw. real verifiziert, VOR jedem Migrations-Slice)

| # | Gate | Kriterium | Status |
|---|---|---|---|
| 1 | **RN-Lightning-Performance** — die 3 Spike-Rails in `@plextv/react-native-lightning` (RN-Primitives + Yoga-Flexbox), gleiche Auto-Probe, S94C Normal-Launch | Fokus-Animation avg ≤ 20 ms UND p95 ≤ 34 ms (identisch zum react-lightning-Gate); Rattern dokumentieren | **ZAHLEN BESTANDEN, SUBSTANZ MIT VORBEHALT** (s. u.) |
| 2 | **AVPlay-Koexistenz** — Video-`<object>` sichtbar hinter transparentem Lightning-Canvas-Loch, D-Pad bleibt bedienbar | Video spielt sichtbar + Canvas-UI darüber funktioniert on-device | **BESTANDEN** (Telemetrie + User-Blick 2026-07-08) |
| 3 | **RN-Web-Look** — eine abyss-Karte (Morph) + ein Glass-Dialog (backdrop-blur!) in `react-native-web` | Look trägt den Renderer-Wechsel im Browser ohne sichtbaren Qualitätsverlust | **BESTANDEN** (2026-07-08, s. u.) |

Scheitert ein Gate → zurück zur Alternativen (TV pur auf react-lightning,
Web bleibt DOM) ohne Migrations-Sunk-Cost.

## Gate-1-Ergebnis (2026-07-08, Branch spike/tv-rn-lightning, S94C Normal-Launch)

**Zahlen: bestanden.** Fokus-Animation avg 17,0 / p95 16,8 / max 33,4 (Gate:
≤ 20/≤ 34); Rattern 19,8; Rail-Wechsel 18,3. Nebenbefund: der Peer-erzwungene
Renderer 3.0.1 (statt beta20) verbesserte die max-Ausreißer.

**Substanz: erheblicher Vorbehalt.** Das Yoga-Flexbox-Plugin — das Fundament
der RN-Schicht — **korrumpiert das Rail-Row-Layout** (Row rendert komplett
leer, sobald der Fokus Index ≥ 8 von 20 erreicht; per Bisektion index-, nicht
timing-abhängig; Plugin-Defekt, nicht App-Logik). Der Fix musste die Karten
aus dem Flex-Flow nehmen (manuelle Absolut-Positionierung) — d. h. die
gemessene Variante nutzt RN-Komponenten nur als dünne Wrapper und **gerade
NICHT die RN-Layout-Semantik** im heißen Pfad. Konsequenz für die
Vereinheitlichungs-These: geteilter RN-Layout-Code (Flex-Styles) würde auf
dem TV anders/fehlerhaft laufen als im Web (react-native-web nutzt echtes
Browser-Flexbox) → nicht-triviale Layouts bräuchten Plattform-Forks, was den
„eine Codebasis"-Gewinn deutlich schmälert. Upstream-Bug-Report an
plexinc/react-lightning empfohlen (aktives Repo, 2 offene Issues).

Weitere Gate-1-Funde: Peer-Kette erzwingt Lockstep-Upgrades (renderer 3.0.1,
react-lightning 0.4.2, vite 8); `transition`-Prop passt durch RN-Komponenten
durch; RN-String-Farben und 0xRRGGBBAA koexistieren; überlappende Layer
brauchen explizit `position:'absolute'` (Yoga-Default ist Column-Flow).

## Gate-2-Ergebnis (2026-07-08, Branch spike/tv-rn-lightning, S94C Normal-Launch)

**Abgeschlossen:** User-Blick auf den S94C (2026-07-08) bestätigt — das
Video scheint sichtbar durch das Canvas-Loch. Damit sind alle 3 Gates
bestanden.

**Telemetrie: bestanden.** AVPlay spielt (open→IDLE, prepared READY mit
korrekter Dauer 180.023 ms, PLAYING; timeMs 27.260→28.865→32.871
wall-clock-synchron, TV zieht das File per Range-Requests). D-Pad-Burst
WÄHREND PLAYING: Fokus rail 0/card 13 → rail 1 ✓. Frame-Stats mit laufendem
Video-Decode auf Gate-1-Niveau: idle avg 16,7 (lock-60), settleAnim avg
16,9/p95 16,8, railSwitch p95 33,3 — Video-Decode kostet die Canvas-UI
nichts. Verbleibender Rest: ob das Video durch das Canvas-Loch **optisch**
durchscheint, ist remote nicht messbar (Video läuft auf separater
Hardware-Plane, kein Screenshot möglich) → App läuft mit geloopter
Testkarte auf dem TV, ein User-Blick schließt das Gate.

**Implementierung (apps/tv-lightning):** `<object type="application/avplayer">`
fullscreen als erstes body-Kind (`position:fixed`, kein z-index nötig — DOM-
Reihenfolge reicht); Canvas `clearColor: 0x00000000` in `RenderOptions`
(Library-Default ist 0x000000FF opak-schwarz; der WebGL-Kontext wird von
Lightning eh mit `alpha:true` erzeugt); Root-View ohne `backgroundColor`;
html/body `background-color: transparent`; AVPlay-Lifecycle wie
`packages/player/src/avplayPlayer.ts` (open → setDisplayRect(0,0,1920,1080)
→ setListener → prepareAsync → play), Zustands-Beacons an den Dev-Listener.

**Lehren:**
- Die klassische BBB-Sample-URL (`commondatastorage.googleapis.com/gtv-videos-bucket/…`)
  liefert inzwischen **HTTP 403** (vom Host verifiziert) — AVPlay meldet das
  irreführend als `PLAYER_ERROR_CONNECTION_FAILED`. Testvideo jetzt
  LAN-gehostet (ffmpeg testsrc2, 3 min 1080p H.264/AAC; node-Server **mit
  Range-Support** — AVPlay fragt Range an; `python3 -m http.server` kann das
  nicht).
- `$WEBAPIS/webapis/webapis.js`-Script-Tag in tizen/index.html ist nötig —
  war zuvor NIRGENDS im Repo (auch nicht in apps/tv → dort ist AVPlay
  on-device also noch nie gelaufen!).
- `http://developer.samsung.com/privilege/avplay` in config.xml ergänzen.
- Loop/Replay nach `onstreamcompleted`: stop → open → setDisplayRect →
  prepareAsync → play (setDisplayRect vor prepare erneut nötig).
- AVPlay-Event-Order nicht garantiert: `onbufferingcomplete` kann vor dem
  prepareAsync-Success feuern (im IDLE-State beobachtet) — Listener nicht
  auf Reihenfolge bauen.
- D-Pad-Handling (window keydown) ist völlig Canvas-/Video-unabhängig —
  keinerlei Fokus-Sonderbehandlung für die Koexistenz nötig.

## Gate-3-Ergebnis (2026-07-08, apps/rn-web-spike, react-native-web 0.21.2)

**Bestanden.** Morph-Karte + Glass-Dialog als RN-Primitives-Mini-App
(View/Text/Image/Pressable, vite-Alias react-native→react-native-web,
Inter Variable via @fontsource-variable/inter). Verifikation per
Computed-Style-Vergleich gegen die abyss-Referenzwerte aus
packages/ui/src/theme.css / MediaPosterButton.tsx / GlassDialog.tsx —
**1:1-Parität**:

- Karte: Slot 240×360→640 nur-width @400ms cubic-bezier(0.16,1,0.3,1);
  Ring als Layered-Box-Shadow `inset 0 0 3px rgb(200 200 200/.35), 0 0 0 3px
  #0a0a0c, 0 0 0 5px #f5f5f7` @300ms; radius 12; Poster→Backdrop-Crossfade
  400ms; Overlay-Gradient `to top, rgba(0,0,0,.85)→.4→0` p16/pt48 — alles
  computed exakt.
- Dialog: frost rgba(42,42,42,.72), **backdrop-filter blur(20px) kommt durch
  und frostet sichtbar** (Screenshot: Panel über expandierter Karte),
  Border 1px rgba(245,245,247,.16), radius 24, Shadow 0 24px 64px
  rgba(0,0,0,.48), maxWidth 512, p20/gap16, Scrim rgba(0,0,0,.6),
  Open-Anim fade+zoom .95 @150ms.
- Inter Variable geladen (Weights 500/600 korrekt), position:fixed
  funktioniert.

**Befunde für die Migrations-Spec:**
- react-native-web 0.21 reicht web-only-CSS-Props (transitionProperty/…,
  boxShadow-String, backgroundImage-Gradient, backdropFilter,
  position:fixed, overflowX) **untypisiert** durch — im Spike per
  @ts-expect-error. Migration braucht einen typisierten Web-Style-Seam
  (Modul-Augmentation oder `webStyle()`-Helper).
- Genau diese Props existieren im Lightning-Backend NICHT (kein
  backdrop-blur, kein CSS-transition-Modell, kein Gradient-Prop) — deckt
  sich mit dem Gate-1-Yoga-Befund: das Design-System braucht eine
  Plattform-Style-Schicht (Web-Vollwert vs. TV-Approximation), keine
  1:1-geteilten Style-Objekte für die Showpieces.
- `dataSet={{ testid }}` → data-testid funktioniert für Test-Hooks.

## Bekannte offene Punkte für die Migrations-Spec (nach Gate-Pass)

- `unsafe-eval` (tseep) in der Tizen-CSP — Samsung-Store-Review-Risiko klären.
- Textur-Preload-Strategie (Epsilon-Alpha nur für Fokus-Nachbarschaft statt
  aller Items; Spike hält alle 60 resident).
- Fast-Nav-Gating (Snap beim Rattern) einplanen — Crossfades bei Schnellfeuer
  kosten (Spike: 19→29 ms mit Look-Parität).
- Rounded/Border-Shader müssen registriert werden (`RenderOptions.shaders`).
- Frosted Glass auf TV: DOM-Messung zeigte Idle-Glass ok, aber Blur-Shader in
  Lightning sind teuer — Design-Fallback pro Plattform definieren.
- Inter→MSDF-Fontpipeline produktiv machen.
