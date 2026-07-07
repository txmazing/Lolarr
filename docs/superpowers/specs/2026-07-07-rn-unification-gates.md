# Lolarr: React-Native-Vereinheitlichung — Entscheidungs-Gates

**Datum:** 2026-07-07
**Status:** Beschlossen unter Vorbehalt (User-Entscheid nach react-lightning-Spike-GO)

## Beschluss

Lolarr stellt die UI auf **React-Native-Primitives** um — Web via
`react-native-web`, TV via `@plextv/react-native-lightning` — **wenn und nur
wenn** die drei Gates unten bestehen. Motivation: eine UI-Codebasis für Web+TV;
Mobile-Apps (RN nativ) sind erwünschter Bonus, kein Treiber. Bewusst
akzeptierte Konsequenz: die bestehende Web-UI (Slice 7 + Redesign,
DOM/Tailwind/shadcn) wird auf RN-Primitives neu gebaut. Die Logik-Schicht
(domain, api-client, jellyfin, player-Kern, features-Hooks/Stores) bleibt —
im react-lightning-Spike als renderer-agnostisch bewiesen.

## Gates (alle on-device bzw. real verifiziert, VOR jedem Migrations-Slice)

| # | Gate | Kriterium | Status |
|---|---|---|---|
| 1 | **RN-Lightning-Performance** — die 3 Spike-Rails in `@plextv/react-native-lightning` (RN-Primitives + Yoga-Flexbox), gleiche Auto-Probe, S94C Normal-Launch | Fokus-Animation avg ≤ 20 ms UND p95 ≤ 34 ms (identisch zum react-lightning-Gate); Rattern dokumentieren | **ZAHLEN BESTANDEN, SUBSTANZ MIT VORBEHALT** (s. u.) |
| 2 | **AVPlay-Koexistenz** — Video-`<object>` sichtbar hinter transparentem Lightning-Canvas-Loch, D-Pad bleibt bedienbar | Video spielt sichtbar + Canvas-UI darüber funktioniert on-device | offen |
| 3 | **RN-Web-Look** — eine abyss-Karte (Morph) + ein Glass-Dialog (backdrop-blur!) in `react-native-web` | Look trägt den Renderer-Wechsel im Browser ohne sichtbaren Qualitätsverlust | offen |

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
