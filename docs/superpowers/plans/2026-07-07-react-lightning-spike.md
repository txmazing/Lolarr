# react-lightning-Spike (`apps/tv-lightning`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wegwerf-Prototyp, der auf dem S94C misst, ob react-lightning animierte Rail-Navigation innerhalb des Go-Kriteriums (avg ≤ 20 ms, p95 ≤ 34 ms) liefert — bei funktionierendem react-query/zustand-Stack und praktikablem D-Pad-Fokus.

**Architecture:** Eigenständige Mini-App `apps/tv-lightning` aus Plex' offiziellem App-Template (`templates/app-template`), reduziert auf einen Home-artigen Screen (3 Rails × 20 TMDB-Poster). Layout manuell absolut (x/y, KEIN Flexbox-Plugin), Fokus deterministisch über einen zustand-Store (Indizes) statt Lightnings Baum-Traversierung, Animation über das deklarative `transition`-Prop. Messung per rAF-Probe → HTTP-POST an den Mac-Listener; Tizen-Deploy über den etablierten CLI-Weg.

**Tech Stack:** `@plextv/react-lightning@0.4.2`, `@plextv/react-lightning-components@0.4.3` (FPSMonitor), `@plextv/vite-plugin-msdf-fontgen`, `@lightningjs/renderer` (Version wie im Template gepinnt!), React 19.2.x, Vite (target esnext), @tanstack/react-query, zustand.

## Global Constraints

- **Wegwerf-Code:** keine Unit-Tests, kein Lint-Perfektionismus, keine Integration in bestehende Packages — nur die Messung muss stimmen (Spec).
- **Exakte Versionen pinnen** (`save-exact`), Scope ist **`@plextv/*`** (nicht `@plexinc/@lightningtv`); `@lightningjs/renderer` in der Version, die das Template pinnt — npm-latest (3.1.1) ist der Workspace-Pin (3.0.x) voraus, NICHT eigenmächtig anheben.
- **Messungen NUR im Normal-Launch** (`sdb shell 0 execute`), nie via `sdb shell 0 debug` (~2×-Verfälschung, gemessen 2026-07-07).
- **Nach jedem Packaging wgt-Inhalt verifizieren** (`unzip -l`); vor dem Packaging `author-signature.xml`, `signature1.xml`, `.manifest.tmp`, `Debug/` aus dem tizen-Ordner löschen.
- **Abbruchkriterium:** ein Lib-Blocker, der > 1 Tag Workaround bräuchte → Spike endet als „No-Go: Lib-Reife", Befund in die Spec (docs/superpowers/specs/2026-07-07-react-lightning-spike-design.md), nicht workarounden.
- Pre-1.0-Lib: Jeder Task beginnt damit, die im Plan zitierte API gegen die INSTALLIERTE Version zu verifizieren (Quelle: node_modules-Typen); Abweichungen im Fazit-Abschnitt der Spec notieren.
- Arbeitsbranch: `spike/tv-lightning` (von `main` nach Merge von PR #3, sonst von `feat/tv-rail-performance`).
- Go-Kriterium (Spec): Fokus-Animation on-device **avg ≤ 20 ms UND p95 ≤ 34 ms**.

---

### Task 1: Scaffold aus dem offiziellen Template + Browser-Smoke

**Files:**
- Create: `apps/tv-lightning/**` (via degit aus `plexinc/react-lightning/templates/app-template`)
- Modify: `pnpm-workspace.yaml` nur falls `apps/*` nicht schon gematcht wird (prüfen — vermutlich keine Änderung nötig)

**Interfaces:**
- Produces: lauffähige Browser-App (`pnpm --filter @lolarr/tv-lightning dev`), `<Canvas keyMap options>`-Bootstrapping, MSDF-Font gebaut. Spätere Tasks bauen im `src/` dieser App.

- [ ] **Step 1: Branch + Scaffold**

```bash
git checkout -b spike/tv-lightning
cd apps && npx degit plexinc/react-lightning/templates/app-template tv-lightning
```

- [ ] **Step 2: package.json anpassen**

`apps/tv-lightning/package.json`: `"name": "@lolarr/tv-lightning"`, `"private": true`. Versionen des Templates NICHT anheben (exakt lassen). Scripts müssen enthalten: `"dev": "vite --host 0.0.0.0"`, `"build": "vite build"`.

- [ ] **Step 3: Installieren + API-Verifikation**

```bash
pnpm install
ls apps/tv-lightning/node_modules/@plextv/react-lightning/dist | head
```

Verifiziere gegen die installierte Version (Typen in `node_modules/@plextv/react-lightning/dist/*.d.ts`): Exporte `Canvas`, `useFocus`, `Keys`, Intrinsics `lng-view`/`lng-image`/`lng-text`, `transition`-Prop. Abweichung von diesem Plan → im Spec-Fazit notieren und Code entsprechend anpassen (kein Blocker).

- [ ] **Step 4: Template entschlacken**

- `react-router-dom` + `pages/` raus; `src/index.tsx` rendert direkt `<Canvas keyMap={keyMap} options={options}><App /></Canvas>` (Bootstrapping-Muster aus dem Template beibehalten: äußeres `createRoot` aus `react-dom/client`, `RenderOptions.fonts` mit der Template-SDF-Font — Ubuntu reicht für den Spike, Inter ist NICHT Beweisziel).
- `keyMap.ts` erweitern um Tizen-Back:

```ts
import { Keys } from '@plextv/react-lightning';

export const keyMap = {
  37: Keys.Left,
  38: Keys.Up,
  39: Keys.Right,
  40: Keys.Down,
  13: Keys.Enter,
  8: Keys.Back,
  27: Keys.Back,
  10009: Keys.Back, // Tizen remote Back
};
```

- `App.tsx` minimal:

```tsx
export const App = () => (
  <lng-view style={{ w: 1920, h: 1080, color: 0x0a0a0cff }}>
    <lng-text style={{ x: 60, y: 40, fontSize: 32, fontFamily: 'sans-serif' }}>
      tv-lightning spike
    </lng-text>
  </lng-view>
);
```

- [ ] **Step 5: Browser-Smoke**

Run: `pnpm --filter @lolarr/tv-lightning dev` → im Browser: dunkler Fullscreen-Canvas mit Text, keine Console-Errors. (Preview-Tooling: Eintrag `tv-lightning` in `.claude/launch.json` ergänzen, Port frei wählen.)

- [ ] **Step 6: Commit**

```bash
git add apps/tv-lightning pnpm-lock.yaml
git commit -m "spike(tv-lightning): scaffold from react-lightning app template"
```

---

### Task 2: Daten + Rails statisch (react-query + zustand — Beweis 2, Teil 1)

**Files:**
- Create: `apps/tv-lightning/src/data/rows.json` (3 Rails × 20 Items: `{ id, title, posterUrl }`, TMDB-URLs `https://image.tmdb.org/t/p/w342/<pfad>.jpg` — 20 reale Poster-Pfade reichen, über die Rails wiederholen)
- Create: `apps/tv-lightning/src/data/useRows.ts`
- Create: `apps/tv-lightning/src/store.ts`
- Create: `apps/tv-lightning/src/components/Rail.tsx`, `src/components/Card.tsx`
- Modify: `apps/tv-lightning/src/App.tsx`, `package.json` (+ `@tanstack/react-query`, `zustand` — gleiche Versionen wie `packages/features`)

**Interfaces:**
- Produces: `useRows(): { data?: Row[], isLoading }` (Row = `{ id: string; title: string; items: Item[] }`); `useFocusStore`: `{ railIndex: number; cardIndex: Record<string, number>; moveLeft/moveRight/moveUp/moveDown(rows: Row[]): void }`; `<Rail row y focusedCard>`-Komponente. Task 3/4 konsumieren Store + Komponenten.

- [ ] **Step 1: Query-Hook (simulierte Latenz — beweist react-query unter Lightning)**

```ts
// src/data/useRows.ts
import { useQuery } from '@tanstack/react-query';
import rows from './rows.json';

export type Item = { id: string; title: string; posterUrl: string };
export type Row = { id: string; title: string; items: Item[] };

export function useRows() {
  return useQuery({
    queryKey: ['rows'],
    queryFn: async (): Promise<Row[]> => {
      await new Promise((r) => setTimeout(r, 300));
      return rows as Row[];
    },
  });
}
```

`QueryClientProvider` in `index.tsx` INNERHALB von `<Canvas>` um `<App/>` legen (Kontext muss durch den Lightning-Reconciler — genau das ist der Beweis).

- [ ] **Step 2: Fokus-Store**

```ts
// src/store.ts
import { create } from 'zustand';
import type { Row } from './data/useRows';

type FocusState = {
  railIndex: number;
  cardIndex: Record<string, number>; // per-rail memory
  moveLeft(rows: Row[]): void;
  moveRight(rows: Row[]): void; // inkl. forward snake am Rail-Ende
  moveUp(): void;
  moveDown(rows: Row[]): void;
};

export const useFocusStore = create<FocusState>((set) => ({
  railIndex: 0,
  cardIndex: {},
  moveLeft: (rows) =>
    set((s) => {
      const rail = rows[s.railIndex];
      const cur = s.cardIndex[rail.id] ?? 0;
      return cur > 0 ? { cardIndex: { ...s.cardIndex, [rail.id]: cur - 1 } } : s;
    }),
  moveRight: (rows) =>
    set((s) => {
      const rail = rows[s.railIndex];
      const cur = s.cardIndex[rail.id] ?? 0;
      if (cur < rail.items.length - 1) {
        return { cardIndex: { ...s.cardIndex, [rail.id]: cur + 1 } };
      }
      // forward snake: letzte Karte + Rechts → erste Karte der nächsten Rail
      if (s.railIndex < rows.length - 1) {
        const next = rows[s.railIndex + 1];
        return { railIndex: s.railIndex + 1, cardIndex: { ...s.cardIndex, [next.id]: 0 } };
      }
      return s;
    }),
  moveUp: () => set((s) => (s.railIndex > 0 ? { railIndex: s.railIndex - 1 } : s)),
  moveDown: (rows) =>
    set((s) => (s.railIndex < rows.length - 1 ? { railIndex: s.railIndex + 1 } : s)),
}));
```

- [ ] **Step 3: Card + Rail statisch rendern (noch ohne Animation/Fokus-Optik)**

Layout-Konstanten (Design-Analog zur echten App): `CARD_W = 240`, `CARD_H = 360`, `GAP = 20`, `CARD_W_EXPANDED = 640`, Rail-Höhe 420, Rails bei y = 120/560/1000 (Rail 3 ragt unten raus — egal, Spike).

```tsx
// src/components/Card.tsx
import type { Item } from '../data/useRows';

export const Card = ({ item, x, focused }: { item: Item; x: number; focused: boolean }) => (
  <lng-view style={{ x, y: 0, w: 240, h: 360 }}>
    {/* fallback rect underneath — texture loads swap in above it */}
    <lng-view style={{ w: 240, h: 360, color: 0x1a1a1eff, borderRadius: 12 }} />
    <lng-image src={item.posterUrl} style={{ w: 240, h: 360, borderRadius: 12 }} />
    {focused ? (
      <lng-view style={{ w: 240, h: 360, borderRadius: 12, border: { w: 4, color: 0xf5f5f7ff } }} />
    ) : null}
  </lng-view>
);
```

```tsx
// src/components/Rail.tsx
import type { Row } from '../data/useRows';
import { Card } from './Card';

export const Rail = ({ row, y, focusedCard, railFocused }: {
  row: Row; y: number; focusedCard: number; railFocused: boolean;
}) => (
  <lng-view style={{ x: 60, y, w: 1800, h: 420 }}>
    <lng-text style={{ x: 0, y: 0, fontSize: 28, fontFamily: 'sans-serif' }}>{row.title}</lng-text>
    <lng-view style={{ x: 0, y: 48, w: 20 * 260, h: 360 }}>
      {row.items.map((item, i) => (
        <Card key={item.id} item={item} x={i * 260} focused={railFocused && i === focusedCard} />
      ))}
    </lng-view>
  </lng-view>
);
```

`App.tsx`: `useRows()` → Loading-Text solange `isLoading`, dann 3 `<Rail>` mit Store-Zustand.

- [ ] **Step 4: Browser-Smoke**

Dev-Server: 3 Rails mit echten Postern sichtbar, Fallback-Rects blitzen vor den Texturen auf, react-query-Latenz zeigt kurz den Loading-Text. Keine Console-Errors.

- [ ] **Step 5: Commit**

```bash
git add apps/tv-lightning
git commit -m "spike(tv-lightning): static rails with tmdb textures via react-query + zustand focus store"
```

---

### Task 3: D-Pad-Fokus (Beweis 3)

**Files:**
- Create: `apps/tv-lightning/src/useDpad.ts`
- Modify: `apps/tv-lightning/src/App.tsx`

**Interfaces:**
- Consumes: `useFocusStore`, `useRows`.
- Produces: Pfeiltasten steuern Fokus deterministisch (Store-Indizes; bewusst NICHT Lightnings Geometrie-Traversierung — gleiches Muster wie `railNavigation.ts` der Haupt-App: Memory + Snake sind Produktanforderungen, keine Geometrie).

- [ ] **Step 1: Key-Handling**

Bevorzugt über Lightnings Fokus-System: Wurzel-`lng-view` mit `useFocus({ autoFocus: true })` + `onKeyUp`/`onKeyDown`-Props (API-Form in Task 1 Step 3 verifiziert — Template-`Button.tsx` nutzt `onKeyUp` mit `event.key === 'Enter'`). Falls die Key-Event-Props auf Root-Ebene nicht greifen: Fallback `window.addEventListener('keydown', ...)` (funktioniert immer, Tizen sendet Standard-Arrow-Keys; Entscheidung im Spec-Fazit notieren).

```ts
// src/useDpad.ts — window-Listener-Variante (Fallback; primär Lightning onKeyDown probieren)
import { useEffect } from 'react';
import { useFocusStore } from './store';
import type { Row } from './data/useRows';

export function useDpad(rows: Row[] | undefined) {
  useEffect(() => {
    if (!rows) return;
    const onKey = (e: KeyboardEvent) => {
      const s = useFocusStore.getState();
      if (e.key === 'ArrowLeft') s.moveLeft(rows);
      else if (e.key === 'ArrowRight') s.moveRight(rows);
      else if (e.key === 'ArrowUp') s.moveUp();
      else if (e.key === 'ArrowDown') s.moveDown(rows);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rows]);
}
```

- [ ] **Step 2: Browser-Verifikation (Tastatur)**

Pfeiltasten: Links/Rechts wandert in der Rail (Ring wandert), Rechts am Rail-Ende springt auf Karte 1 der nächsten Rail (Snake), Hoch/Runter wechselt Rail und LANDET auf der gemerkten Karte (Memory). Ecken: erste Karte + Links = no-op; letzte Rail + Runter = no-op.

- [ ] **Step 3: Commit**

```bash
git add apps/tv-lightning
git commit -m "spike(tv-lightning): deterministic d-pad focus (per-rail memory + forward snake)"
```

---

### Task 4: Fokus-Animation (Beweis 1 — das, was DOM nicht kann)

**Files:**
- Modify: `apps/tv-lightning/src/components/Card.tsx`, `Rail.tsx`

**Interfaces:**
- Consumes: `transition`-Prop (`Animatable`) — Wertänderung im Style wird über `duration` getweent.
- Produces: Morph-Analog: fokussierte Karte expandiert 240→640 (w-Tween + Titel-Overlay-Alpha), Nachbarn weichen aus (x-Tween), Rail scrollt (Container-x-Tween). 400 ms, wie der Web-Morph.

- [ ] **Step 1: Card expandiert + Overlay**

```tsx
// Card.tsx — neue Fassung
import type { Item } from '../data/useRows';

const DUR = { duration: 400 };

export const Card = ({ item, x, focused }: { item: Item; x: number; focused: boolean }) => {
  const w = focused ? 640 : 240;
  return (
    <lng-view style={{ x, y: 0, w, h: 360, zIndex: focused ? 10 : 1 }} transition={{ x: DUR, w: DUR }}>
      <lng-view style={{ w, h: 360, color: 0x1a1a1eff, borderRadius: 12 }} transition={{ w: DUR }} />
      <lng-image src={item.posterUrl} style={{ w, h: 360, borderRadius: 12 }} transition={{ w: DUR }} />
      <lng-view
        style={{ x: 0, y: 280, w, h: 80, color: 0x000000aa, alpha: focused ? 1 : 0, borderRadius: 12 }}
        transition={{ alpha: DUR, w: DUR }}
      >
        <lng-text style={{ x: 20, y: 20, fontSize: 26, fontFamily: 'sans-serif' }}>{item.title}</lng-text>
      </lng-view>
      <lng-view
        style={{ w, h: 360, borderRadius: 12, border: { w: focused ? 4 : 0, color: 0xf5f5f7ff }, alpha: focused ? 1 : 0 }}
        transition={{ alpha: { duration: 200 }, w: DUR }}
      />
    </lng-view>
  );
};
```

Hinweis: `lng-image` mit animierter `w` skaliert die Textur (object-fit-Verhalten prüfen — wenn verzerrt: stattdessen `scale`-Tween auf dem Karten-Container; Abweichung notieren). Poster-Quelle bleibt 342er-Breite — Qualität ist nicht Beweisziel.

- [ ] **Step 2: Nachbarn weichen aus + Rail scrollt**

`Rail.tsx`: Karten-x wird fokusabhängig berechnet (Karten NACH der fokussierten +400), Container-x scrollt die fokussierte Karte in Sicht:

```tsx
export const Rail = ({ row, y, focusedCard, railFocused }: {
  row: Row; y: number; focusedCard: number; railFocused: boolean;
}) => {
  const DUR = { duration: 400 };
  const scrollX = railFocused ? -Math.max(0, focusedCard * 260 - 520) : 0;
  return (
    <lng-view style={{ x: 60, y, w: 1800, h: 420, clipping: true }}>
      <lng-text style={{ x: 0, y: 0, fontSize: 28, fontFamily: 'sans-serif' }}>{row.title}</lng-text>
      <lng-view style={{ x: scrollX, y: 48, w: 20 * 260 + 400, h: 360 }} transition={{ x: DUR }}>
        {row.items.map((item, i) => {
          const shifted = railFocused && i > focusedCard ? 400 : 0;
          return (
            <Card key={item.id} item={item} x={i * 260 + shifted}
              focused={railFocused && i === focusedCard} />
          );
        })}
      </lng-view>
    </lng-view>
  );
};
```

- [ ] **Step 3: Browser-Verifikation**

Fokuswechsel: Karte expandiert flüssig, Nachbarn gleiten, Rail scrollt, Overlay blendet ein; Rattern (Taste halten) bleibt bedienbar (Tweens retargeten). Desktop ist hier nur Funktions-, nicht Perf-Beweis.

- [ ] **Step 4: Commit**

```bash
git add apps/tv-lightning
git commit -m "spike(tv-lightning): focus expand animation with neighbor shift and rail scroll"
```

---

### Task 5: Messung — FPS-Overlay + Auto-Probe

**Files:**
- Create: `apps/tv-lightning/src/probe.ts`
- Modify: `apps/tv-lightning/src/App.tsx` (FPSMonitor + Probe-Aufruf), `package.json` (+ `@plextv/react-lightning-components@0.4.3` für `FPSMonitor` — falls dessen API nicht passt: eigenes `lng-text`-Overlay mit rAF-avg, 20 Zeilen)

**Interfaces:**
- Consumes: Listener-Muster vom 2026-07-07 (`perf-listener.mjs` im Scratchpad-Stil, Port 9099).
- Produces: Auto-Szenario 15 s nach Load → POST `{ probe, idle, settleAnim, rattle, railSwitch }` an `http://192.168.1.221:9099/report`; permanentes FPS-Overlay oben rechts.

- [ ] **Step 1: Probe portieren**

`src/probe.ts` = das bewährte Muster (rAF-Recorder, stats mit n/avg/max/p95/over17, `press()` via synthetischer `KeyboardEvent` auf `window` — funktioniert mit der window-Listener-Variante aus Task 3; falls Task 3 Lightning-Key-Props nutzt, dispatcht die Probe stattdessen direkt Store-Aktionen). Szenarien: 3 s idle → 5× Fokuswechsel @1200 ms (settleAnim) → 12× Rechts @60 ms (rattle) → 4× Runter/Hoch @900 ms (railSwitch). POST an beide Mac-IPs (.221 primär, .151 fallback).

- [ ] **Step 2: Browser-Lauf**

Probe feuert im Dev-Server, Report erreicht den lokalen Listener (`node perf-listener.mjs`), Overlay zeigt plausible Desktop-Werte (~16.7).

- [ ] **Step 3: Commit**

```bash
git add apps/tv-lightning
git commit -m "spike(tv-lightning): fps overlay + auto measurement probe"
```

---

### Task 6: Tizen-Deploy + On-Device-Messung + Fazit (Gate)

**Files:**
- Create: `apps/tv-lightning/vite.tizen.config.ts` (nach `apps/tv`-Muster: IIFE-Single-Bundle; `target: 'es2017'`, `cssTarget` irrelevant — kein CSS), `apps/tv-lightning/tizen/` (config.xml mit EIGENER App-ID/anderem Paketnamen als `aNw7se2Ek4`, `required_version`, CSP wie `apps/tv`; index.html lädt das IIFE-Bundle synchron), Sync-Script analog `tizen:sync`
- Modify: `docs/superpowers/specs/2026-07-07-react-lightning-spike-design.md` (Fazit-Abschnitt)

**Interfaces:**
- Consumes: etablierter Deploy-Weg (tizen CLI `package`/`install` mit Profil `txmazing-sc`, Target `192.168.1.150:26101`, Host-PC-IP .221), Listener auf :9099.
- Produces: Messwerte + Go/No-Go-Fazit in der Spec — das Spike-Deliverable.

- [ ] **Step 1: Tizen-Build + Paket**

`pnpm --filter @lolarr/tv-lightning tizen:sync`, dann Signatur-Reste löschen, `tizen package -t wgt -s txmazing-sc -- tizen -o <out>`, **`unzip -l` prüfen** (Bundle + Fonts + index.html drin, kein `Debug/`), `tizen install`, Launch via `sdb shell 0 execute <neue-app-id>`.

Achtung Fonts: die MSDF-Atlas-Dateien (`public/fonts/*.msdf.png/json`) müssen im Tizen-Paket landen und die `atlasUrl`-Pfade relativ funktionieren (`./fonts/...`).

- [ ] **Step 2: Normal-Launch-Messung**

Listener starten, App am TV kalt starten (nach Install ist der Start frisch), Report abwarten. Bei Ausreißern: TV 2 min ruhen lassen (Boot-Noise), Messung per App-Exit/Neustart wiederholen — 2 konsistente Läufe zählen.

- [ ] **Step 3: Gate auswerten + Fazit schreiben**

Spec-Abschnitt „Fazit" ergänzen: Tabelle (idle/settleAnim/rattle/railSwitch: avg/max/p95/over17) vs. Go-Kriterium (**avg ≤ 20 UND p95 ≤ 34 für settleAnim**), Go/No-Go je Beweisziel (Animation/React-Stack/D-Pad), Reibungspunkte-Liste, Aufwandsschätzung Rewrite (Screens/Overlays/Player-UI/Fokus), API-Abweichungsnotizen aus Tasks 1-5.

- [ ] **Step 4: Commit + Abschluss**

```bash
git add apps/tv-lightning docs/superpowers/specs/2026-07-07-react-lightning-spike-design.md
git commit -m "spike(tv-lightning): tizen packaging + on-device measurement + verdict"
```

Branch pushen; ob PR oder nur Branch-Archiv entscheidet der User mit dem Go/No-Go.
