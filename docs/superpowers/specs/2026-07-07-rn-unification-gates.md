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
| 1 | **RN-Lightning-Performance** — die 3 Spike-Rails in `@plextv/react-native-lightning` (RN-Primitives + Yoga-Flexbox), gleiche Auto-Probe, S94C Normal-Launch | Fokus-Animation avg ≤ 20 ms UND p95 ≤ 34 ms (identisch zum react-lightning-Gate); Rattern dokumentieren | offen |
| 2 | **AVPlay-Koexistenz** — Video-`<object>` sichtbar hinter transparentem Lightning-Canvas-Loch, D-Pad bleibt bedienbar | Video spielt sichtbar + Canvas-UI darüber funktioniert on-device | offen |
| 3 | **RN-Web-Look** — eine abyss-Karte (Morph) + ein Glass-Dialog (backdrop-blur!) in `react-native-web` | Look trägt den Renderer-Wechsel im Browser ohne sichtbaren Qualitätsverlust | offen |

Scheitert ein Gate → zurück zur Alternativen (TV pur auf react-lightning,
Web bleibt DOM) ohne Migrations-Sunk-Cost.

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
