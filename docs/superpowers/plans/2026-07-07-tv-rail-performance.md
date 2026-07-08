# TV-Rail-Performance (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rail-Navigation auf dem Samsung S94C flüssig machen (Morph, D-Pad-Rattern, Rail-Scroll) — visuell null Verlust.

**Architecture:** Phase 1 der Spec [2026-07-07-tv-rail-performance-design.md](../specs/2026-07-07-tv-rail-performance-design.md): Key-Repeat-Gating der Card-Transitions (`data-nav-fast` auf `:root`), Query-Cache mit MutationObserver-Invalidierung in `railNavigation.ts`, Norigin-Throttle auf TV, CSS-Containment (`contain`, `content-visibility`), Bild-Optimierung (`decoding="async"`, DPR-bewusste Postergröße). Messung vor (Task 1) und nach (Task 7) entscheidet über Phase 2 — **Phase 2 (Compositor-Morph) bekommt bei Bedarf einen eigenen Plan**, sie hängt von den Messergebnissen ab.

**Tech Stack:** React 19, Vite, Tailwind v4 (theme.css), Norigin Spatial Navigation, Vitest + jsdom + Testing Library. Monorepo mit pnpm workspaces.

## Global Constraints

- Visueller Endzustand jeder Karte (Morph 240→640 px, Glow, Crossfade, Glass) bleibt pixel-identisch; nur Timing-Verhalten bei schnellem Rattern ändert sich (Snap statt Animation) — Spec-gedeckt.
- Browser-Floor: Tizen 9.0 / Chromium M120 (`content-visibility`, `contain` verfügbar).
- `packages/ui` bleibt Norigin-frei (bestehende Dependency-Injection-Konstruktion nicht aufweichen).
- Neue Code-Kommentare auf Englisch (deutsche Kommentare sind ein bekanntes Backlog-Item).
- Arbeitsbranch: `feat/tv-rail-performance` (von `main`).
- Testkommandos: `pnpm --filter @lolarr/ui test`, `pnpm --filter @lolarr/features test`, Typecheck je Paket `pnpm --filter <name> typecheck`.

---

### Task 1: Baseline-Messung (kein Code)

**Files:** keine (Artefakte außerhalb des Repos, Ergebnisse kommen später in die PR-Beschreibung)

**Interfaces:**
- Produces: drei Baseline-Traces + Notiz der Jank-Hotspots; Vergleichsgrundlage für Task 7.

- [ ] **Step 1: Branch anlegen**

```bash
git checkout -b feat/tv-rail-performance
```

- [ ] **Step 2: Web-Preview starten und TV-Bedingungen simulieren**

Dev-Server der Web-App starten (Preview-Tooling bzw. `pnpm --filter @lolarr/web dev`), Chrome DevTools → Performance-Panel → CPU-Throttling **6× slowdown**, Viewport 1920×1080.

- [ ] **Step 3: Drei Szenarien tracen (je ~10 s, als Baseline speichern)**

1. **Morph ruhig:** Auf Home per Pfeiltasten langsam (1 Tastendruck/Sekunde) 5 Karten nach rechts — Trace zeigt Kosten eines einzelnen Morphs.
2. **Rattern:** Pfeiltaste Rechts ~5 s gedrückt halten auf einer langen Rail.
3. **Rail-Scroll vertikal:** 5× Pfeil Runter durch die Rails.

Pro Trace notieren: Anteil Layout/Recalculate-Style (lila) vs. Paint vs. Scripting, längste Frame-Zeit, ob `width`-Transition-Frames Layout der ganzen Rail zeigen. Traces als `.json` lokal sichern (DevTools „Save profile"), Dateinamen mit Szenario.

Erwartung laut statischer Analyse: Szenario 1+3 dominiert von Layout (Rail-Reflow durch `width`-Transition), Szenario 2 zusätzlich Scripting (`querySelectorAll` pro Keydown).

- [ ] **Step 4: Hotspots als Kommentar festhalten**

Kurznotiz (3-5 Sätze) mit den Zahlen — wird in Task 7 mit den Nachher-Werten in die PR-Beschreibung übernommen. Kein Commit (nichts geändert).

---

### Task 2: Fast-Nav-Gating (`data-nav-fast`)

**Files:**
- Modify: `packages/ui/src/lib/focusScroll.ts` (neue Funktion am Dateiende)
- Modify: `packages/ui/src/theme.css` (neue Regel nach dem `.lolarr-card`-Block, vor `.lolarr-rail`)
- Modify: `apps/tv/src/App.tsx:223` (Umfeld: bestehende `useEffect(() => installModalityTracking(), [])`)
- Modify: `apps/web/src/focus/WebShell.tsx:39` (analog)
- Test: `packages/ui/tests/fastNav.test.ts` (neu)

**Interfaces:**
- Consumes: nichts Neues; `focusScroll.ts` ist bereits das Norigin-freie Modality-Modul, wird via `export * from './lib/focusScroll'` aus `packages/ui/src/index.ts:38` re-exportiert (kein Index-Edit nötig).
- Produces: `installFastNavTracking(): () => void` — setzt bei gehaltener/schnell wiederholter Pfeiltaste `data-nav-fast="true"` auf `<html>`, räumt es ~200 ms nach dem letzten Tastendruck. Konsumiert von beiden App-Shells und von der CSS-Regel.

- [ ] **Step 1: Failing Test schreiben**

`packages/ui/tests/fastNav.test.ts` (neu):

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFastNavTracking } from '@ui/lib/focusScroll'

let cleanup: () => void

function press(key: string, repeat = false) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, repeat, bubbles: true }))
}

beforeEach(() => {
  vi.useFakeTimers()
  cleanup = installFastNavTracking()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  delete document.documentElement.dataset.navFast
})

describe('installFastNavTracking', () => {
  it('a single arrow press does not enter fast mode', () => {
    press('ArrowRight')
    expect(document.documentElement.dataset.navFast).toBeUndefined()
  })

  it('key repeat enters fast mode immediately', () => {
    press('ArrowRight')
    press('ArrowRight', true)
    expect(document.documentElement.dataset.navFast).toBe('true')
  })

  it('two rapid presses enter fast mode', () => {
    press('ArrowRight')
    vi.advanceTimersByTime(100)
    press('ArrowRight')
    expect(document.documentElement.dataset.navFast).toBe('true')
  })

  it('slow presses never enter fast mode', () => {
    press('ArrowRight')
    vi.advanceTimersByTime(400)
    press('ArrowRight')
    expect(document.documentElement.dataset.navFast).toBeUndefined()
  })

  it('fast mode clears shortly after the last press', () => {
    press('ArrowRight')
    press('ArrowRight', true)
    expect(document.documentElement.dataset.navFast).toBe('true')
    vi.advanceTimersByTime(200)
    expect(document.documentElement.dataset.navFast).toBeUndefined()
  })

  it('held key keeps fast mode alive across repeats', () => {
    press('ArrowRight')
    for (let i = 0; i < 5; i += 1) {
      vi.advanceTimersByTime(50)
      press('ArrowRight', true)
    }
    expect(document.documentElement.dataset.navFast).toBe('true')
  })

  it('non-arrow keys are ignored', () => {
    press('Enter')
    press('Enter', true)
    expect(document.documentElement.dataset.navFast).toBeUndefined()
  })

  it('cleanup removes attribute and pending timer', () => {
    press('ArrowRight')
    press('ArrowRight', true)
    cleanup()
    expect(document.documentElement.dataset.navFast).toBeUndefined()
    // Re-install so afterEach cleanup stays valid.
    cleanup = installFastNavTracking()
  })
})
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `pnpm --filter @lolarr/ui test tests/fastNav.test.ts`
Expected: FAIL — `installFastNavTracking` ist kein Export von `@ui/lib/focusScroll`.

- [ ] **Step 3: Implementierung in `focusScroll.ts`**

Am Dateiende von `packages/ui/src/lib/focusScroll.ts` anfügen:

```ts
// Rapid arrow-key navigation (held key or fast tapping) mirrors onto the root
// as data-nav-fast so CSS can suspend the expensive card transitions (width
// morph, glow, crossfade) and let focus snap. The attribute clears shortly
// after the last press, so the morph only plays once focus settles. A single
// isolated press never enters fast mode — normal navigation stays animated.
const FAST_NAV_INTERVAL_MS = 250
const FAST_NAV_CLEAR_MS = 200
const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

export function installFastNavTracking(): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  let lastArrowAt = Number.NEGATIVE_INFINITY
  let clearTimer: ReturnType<typeof setTimeout> | undefined

  function setFast(fast: boolean) {
    if (fast) {
      document.documentElement.dataset.navFast = 'true'
    } else {
      delete document.documentElement.dataset.navFast
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!ARROW_KEYS.has(event.key)) {
      return
    }
    const now = Date.now()
    if (event.repeat || now - lastArrowAt < FAST_NAV_INTERVAL_MS) {
      setFast(true)
      if (clearTimer !== undefined) {
        clearTimeout(clearTimer)
      }
      clearTimer = setTimeout(() => setFast(false), FAST_NAV_CLEAR_MS)
    }
    lastArrowAt = now
  }

  window.addEventListener('keydown', handleKeydown, true)
  return () => {
    window.removeEventListener('keydown', handleKeydown, true)
    if (clearTimer !== undefined) {
      clearTimeout(clearTimer)
    }
    setFast(false)
  }
}
```

- [ ] **Step 4: Test laufen lassen — muss grün sein**

Run: `pnpm --filter @lolarr/ui test tests/fastNav.test.ts`
Expected: PASS (8 Tests).

- [ ] **Step 5: CSS-Test ergänzen (failing)**

In `packages/ui/tests/tokens.test.tsx` innerhalb des bestehenden `describe('design tokens', ...)` anfügen:

```tsx
  it('suspends card transitions while data-nav-fast is set', () => {
    expect(css).toContain(":root[data-nav-fast='true']")
    expect(css).toMatch(/data-nav-fast[^}]*transition: none/s)
  })
```

Run: `pnpm --filter @lolarr/ui test tests/tokens.test.tsx`
Expected: FAIL (Regel existiert noch nicht).

- [ ] **Step 6: CSS-Regel in `theme.css`**

In `packages/ui/src/theme.css` direkt nach dem `@media (prefers-reduced-motion: reduce)`-Block der Card-Regeln (nach Zeile 322, vor dem `.lolarr-rail`-Kommentar) einfügen:

```css
/* While the remote/keyboard is rattling (held or rapid arrow keys —
   data-nav-fast, see installFastNavTracking), suspend the expensive card
   transitions so focus snaps instantly. The morph/glow/crossfade only plays
   once focus settles; end states are identical. `.transition-transform`
   covers the landscape-card scale. */
:root[data-nav-fast='true']
  :is(
    .lolarr-card-slot,
    .lolarr-card,
    .lolarr-poster,
    .lolarr-backdrop,
    .lolarr-overlay,
    .lolarr-art,
    .transition-transform
  ) {
  transition: none;
}
```

Run: `pnpm --filter @lolarr/ui test tests/tokens.test.tsx`
Expected: PASS.

- [ ] **Step 7: In beiden Shells installieren**

`apps/tv/src/App.tsx` — Import um `installFastNavTracking` erweitern (bei den bestehenden `@lolarr/ui`-Imports, Zeilen 13-14) und neben dem bestehenden Effekt (Zeile 223) ergänzen:

```tsx
  useEffect(() => installFastNavTracking(), [])
```

`apps/web/src/focus/WebShell.tsx` — Import erweitern (Zeilen 10-11) und neben `useEffect(() => installModalityTracking(), [])` (Zeile 39) ergänzen:

```tsx
  useEffect(() => installFastNavTracking(), [])
```

- [ ] **Step 8: Volles Gate + visuelle Stichprobe**

Run: `pnpm --filter @lolarr/ui test && pnpm --filter @lolarr/tv typecheck && pnpm --filter @lolarr/web typecheck`
Expected: alles grün.

Web-Preview: Pfeiltaste auf einer Rail gedrückt halten → Karten snappen ohne Morph; loslassen, einzelner Tastendruck → Morph animiert wie vorher. Einzelne langsame Navigation unverändert.

- [ ] **Step 9: Commit**

```bash
git add packages/ui/src/lib/focusScroll.ts packages/ui/src/theme.css packages/ui/tests/fastNav.test.ts packages/ui/tests/tokens.test.tsx apps/tv/src/App.tsx apps/web/src/focus/WebShell.tsx
git commit -m "perf(nav): suspend card transitions during rapid d-pad input (data-nav-fast)"
```

---

### Task 3: Query-Cache in `railNavigation.ts`

**Files:**
- Modify: `packages/ui/src/lib/railNavigation.ts` (kompletter Umbau der Lookup-Helfer, Handler-Logik bleibt)
- Test: `packages/ui/tests/railNavigation.test.ts` (bestehende Tests müssen unverändert grün bleiben; neue Tests dazu)

**Interfaces:**
- Consumes: DOM-Kontrakt unverändert (`data-rail`, `data-focus-key`).
- Produces: `installRailNavigation(deps)` — Signatur und Verhalten identisch; intern gecachte Lookups. Öffentliche API ändert sich nicht.

- [ ] **Step 1: Neue Tests schreiben (failing für Cache-Verhalten)**

In `packages/ui/tests/railNavigation.test.ts` ans Ende des bestehenden `describe` anfügen:

```ts
  it('scans the document only once across repeated presses (cache reuse)', () => {
    currentKey = 'r1-a'
    const spy = vi.spyOn(document, 'querySelectorAll')
    press('ArrowDown')
    currentKey = 'r2-a'
    press('ArrowUp')
    currentKey = 'r1-a'
    press('ArrowDown')
    const railScans = spy.mock.calls.filter(([selector]) => selector === '[data-rail]').length
    expect(railScans).toBe(1)
    spy.mockRestore()
  })

  it('picks up rails added after install (observer invalidation)', async () => {
    currentKey = 'r2-a'
    press('ArrowDown') // builds the cache; no rail below r2 yet
    expect(setFocus).not.toHaveBeenCalled()

    const rail = document.createElement('div')
    rail.setAttribute('data-rail', 'r3')
    rail.innerHTML = '<button data-focus-key="r3-a"></button>'
    document.body.appendChild(rail)
    // Let the MutationObserver deliver its records (macrotask flush).
    await new Promise((resolve) => setTimeout(resolve, 0))

    press('ArrowDown')
    expect(setFocus).toHaveBeenLastCalledWith('r3-a')
  })
```

Hinweis: der bestehende Test „falls back to the first card when the remembered card no longer exists" entfernt eine Karte synchron vor dem nächsten Tastendruck — der Cache muss das ohne Observer-Flush überleben (isConnected-Guard, siehe Step 3).

- [ ] **Step 2: Tests laufen lassen — Cache-Reuse-Test muss fehlschlagen**

Run: `pnpm --filter @lolarr/ui test tests/railNavigation.test.ts`
Expected: FAIL beim Cache-Reuse-Test (`railScans` ist heute = Anzahl der Presses, nicht 1). Der Observer-Test kann heute grün sein (Live-Queries sehen neue Rails sowieso) — das ist ok, er sichert das neue Verhalten ab.

- [ ] **Step 3: Implementierung**

`packages/ui/src/lib/railNavigation.ts` — die vier Modul-Helfer `cardByKey`/`railOf`/`cardsIn`/`keyOf` werden teilweise in die Installation gezogen (Cache ist Instanz-Zustand). Neue Fassung der Datei:

```ts
// Deterministic rail-grid navigation layered on top of Norigin Spatial
// Navigation. Kept Norigin-free (packages/ui constraint) via dependency
// injection: the shell passes Norigin's `setFocus` + `getCurrentFocusKey`.
//
// It gives the media rails two behaviours geometry alone can't:
//   • per-rail focus memory — Up/Down moves rail-to-rail and resumes each rail
//     at the card you last left it on (not the geometrically-nearest one);
//   • forward snake — Right on the last card of a rail jumps to the first card
//     of the next rail instead of dead-ending.
//
// DOM contract: each rail's scroll container carries `data-rail="<id>"`; each
// focusable card carries `data-focus-key="<key>"` (the same key Norigin uses).
//
// Lookups are cached so arrow-key handling never rescans the whole document
// per keypress (rails are not virtualised — hundreds of cards are mounted).
// A MutationObserver drops the cache on any DOM change; isConnected guards
// catch same-task removals the (async) observer has not delivered yet.

type RailNavDeps = {
  setFocus: (focusKey: string) => void
  getCurrentFocusKey: () => string
}

type RailNavCache = {
  cardByKey: Map<string, HTMLElement>
  rails: HTMLElement[]
  cardsByRail: Map<HTMLElement, HTMLElement[]>
}

function buildCache(): RailNavCache {
  const cardByKey = new Map<string, HTMLElement>()
  const cardsByRail = new Map<HTMLElement, HTMLElement[]>()
  const rails = Array.from(document.querySelectorAll<HTMLElement>('[data-rail]'))
  for (const rail of rails) {
    const cards = Array.from(rail.querySelectorAll<HTMLElement>('[data-focus-key]'))
    cardsByRail.set(rail, cards)
    for (const card of cards) {
      const key = card.getAttribute('data-focus-key')
      if (key) {
        cardByKey.set(key, card)
      }
    }
  }
  return { cardByKey, rails, cardsByRail }
}

function railOf(el: Element | null): HTMLElement | null {
  return (el?.closest<HTMLElement>('[data-rail]')) ?? null
}

function keyOf(el: Element | null): string | null {
  return el?.getAttribute('data-focus-key') ?? null
}

export function installRailNavigation(deps: RailNavDeps): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  // railId -> the card key last focused within that rail.
  const lastCardByRail = new Map<string, string>()

  let cache: RailNavCache | null = null
  const observer = new MutationObserver(() => {
    cache = null
  })
  observer.observe(document.body, { childList: true, subtree: true })

  function getCache(): RailNavCache {
    cache ??= buildCache()
    return cache
  }

  function cardByKey(key: string): HTMLElement | null {
    if (!key) {
      return null
    }
    const el = getCache().cardByKey.get(key) ?? null
    if (el && !el.isConnected) {
      cache = null
      return getCache().cardByKey.get(key) ?? null
    }
    return el
  }

  function cardsIn(rail: HTMLElement): HTMLElement[] {
    const cards = getCache().cardsByRail.get(rail) ?? []
    if (cards.some((card) => !card.isConnected)) {
      cache = null
      return getCache().cardsByRail.get(rail) ?? []
    }
    return cards
  }

  function railList(): HTMLElement[] {
    const rails = getCache().rails
    if (rails.some((rail) => !rail.isConnected)) {
      cache = null
      return getCache().rails
    }
    return rails
  }

  function currentCard(): HTMLElement | null {
    return cardByKey(deps.getCurrentFocusKey())
  }

  // The card to focus when entering `rail`: the remembered one if it still
  // lives in this rail, else the first card.
  function entryCard(rail: HTMLElement): HTMLElement | null {
    const railId = rail.getAttribute('data-rail') ?? ''
    const remembered = lastCardByRail.get(railId)
    if (remembered) {
      const el = cardByKey(remembered)
      if (el && railOf(el) === rail) {
        return el
      }
    }
    return cardsIn(rail)[0] ?? null
  }

  function moveTo(target: HTMLElement | null, event: KeyboardEvent): void {
    const key = keyOf(target)
    if (!key) {
      return
    }
    event.preventDefault()
    event.stopImmediatePropagation()
    deps.setFocus(key)
  }

  function handleKeydown(event: KeyboardEvent): void {
    const { key } = event
    if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'ArrowLeft' && key !== 'ArrowRight') {
      return
    }

    const card = currentCard()
    const rail = railOf(card)

    // Record where we are before moving, so a rail resumes where we left it.
    if (card && rail) {
      lastCardByRail.set(rail.getAttribute('data-rail') ?? '', keyOf(card) ?? '')
    }

    // Not on a rail card (nav, hero, dialog) — let Norigin handle it.
    if (!card || !rail) {
      return
    }

    const rails = railList()
    const idx = rails.indexOf(rail)

    if (key === 'ArrowDown') {
      const next = rails[idx + 1]
      if (next) {
        moveTo(entryCard(next), event)
      }
      return
    }

    if (key === 'ArrowUp') {
      const prev = rails[idx - 1]
      // No previous rail → let Norigin navigate up out of the rails (hero/nav).
      if (prev) {
        moveTo(entryCard(prev), event)
      }
      return
    }

    if (key === 'ArrowRight') {
      const cards = cardsIn(rail)
      // Only snake at the end of the rail; otherwise Norigin moves within it.
      if (cards[cards.length - 1] === card) {
        const next = rails[idx + 1]
        if (next) {
          moveTo(cardsIn(next)[0] ?? null, event)
        }
      }
      return
    }

    // ArrowLeft: forward-only snake — no wrap; Norigin handles within-rail.
  }

  window.addEventListener('keydown', handleKeydown, true)
  return () => {
    window.removeEventListener('keydown', handleKeydown, true)
    observer.disconnect()
  }
}
```

Achtung Verhaltens-Detail: das alte `cardByKey` fand auch Fokus-Keys **außerhalb** von Rails (Hero, Nav) und lief dann in den `!rail`-Early-Return. Der Cache indiziert nur Karten **in** Rails — ein Hero-Key liefert jetzt `card = null` und landet im selben Early-Return. Verhalten nach außen identisch (bestehender Test „does not intercept when focus is not on a rail card" deckt das).

- [ ] **Step 4: Alle Tests laufen lassen**

Run: `pnpm --filter @lolarr/ui test tests/railNavigation.test.ts`
Expected: PASS — alle 8 Alt-Tests + 2 neue.

- [ ] **Step 5: Volles ui-Gate**

Run: `pnpm --filter @lolarr/ui test && pnpm --filter @lolarr/ui typecheck`
Expected: grün.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/lib/railNavigation.ts packages/ui/tests/railNavigation.test.ts
git commit -m "perf(nav): cache rail/card lookups instead of rescanning the DOM per keypress"
```

---

### Task 4: Norigin-Throttle auf TV

**Files:**
- Modify: `apps/tv/src/spatial-navigation.ts:13`

**Interfaces:**
- Consumes: Norigin `init`-Option `throttle` (ms — drosselt die Keydown-Verarbeitung der Engine).
- Produces: nichts Neues; Web (`apps/web/src/spatial-navigation.ts`) bleibt bewusst bei `throttle: 0` (Maus dominiert dort, Symptom ist TV).

- [ ] **Step 1: Wert ändern**

`apps/tv/src/spatial-navigation.ts` — `throttle: 0` ersetzen durch:

```ts
    // Rattling the remote at 0 throttle re-measures the whole focusable
    // geometry per key repeat; 100ms caps that without feeling laggy on the
    // device. Calibrate on the S94C (Task 7) — raise/lower if needed.
    throttle: 100,
```

Hinweis: das eigene `installRailNavigation` (Up/Down/Snake) hängt **vor** Norigin am `window`-Keydown und bleibt ungedrosselt — Rail-zu-Rail bleibt sofort responsiv, nur Norigins geometrische Berechnung (Links/Rechts innerhalb der Rail, Hero/Nav) wird gedrosselt. Zusammen mit Task 2 (Snap statt Morph beim Rattern) ist das die gewollte Balance.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @lolarr/tv typecheck`
Expected: grün.

- [ ] **Step 3: Commit**

```bash
git add apps/tv/src/spatial-navigation.ts
git commit -m "perf(tv): throttle norigin key processing to 100ms"
```

---

### Task 5: CSS-Containment

**Files:**
- Modify: `packages/ui/src/theme.css` (`.lolarr-card-slot`, `.lolarr-card`, `.lolarr-rail`)
- Test: `packages/ui/tests/tokens.test.tsx`

**Interfaces:**
- Consumes: bestehende Klassenstruktur (Slot → Card → Layer; Rail-Scroller `.lolarr-rail` aus `MediaRail.tsx:28`).
- Produces: reine CSS-Änderung, keine API.

- [ ] **Step 1: Failing Test**

In `packages/ui/tests/tokens.test.tsx` anfügen:

```tsx
  it('contains card layout and skips offscreen rail rendering', () => {
    expect(css).toContain('contain: layout style')
    expect(css).toContain('content-visibility: auto')
    expect(css).toContain('contain-intrinsic-block-size: auto 420px')
  })
```

Run: `pnpm --filter @lolarr/ui test tests/tokens.test.tsx`
Expected: FAIL.

- [ ] **Step 2: CSS ergänzen**

`packages/ui/src/theme.css`:

`.lolarr-card-slot` (Zeile 238) — Property ergänzen:

```css
.lolarr-card-slot {
  --exp-delay: 0ms;
  position: relative;
  flex: 0 0 auto;
  width: var(--card-w);
  height: var(--card-h);
  transition: width 400ms var(--ease-out-expo) var(--exp-delay);
  /* Inner churn (crossfade layers, badges) must not leak layout/style work
     into the rail. Does not stop the slot's own width transition from
     reflowing the rail — that is phase 2's compositor morph. */
  contain: layout style;
}
```

`.lolarr-card` (Zeile 259) — Property ergänzen (gleicher Kommentar-Geist, kurz):

```css
  contain: layout style;
```

`.lolarr-rail` (Zeile 326) — Block erweitern:

```css
.lolarr-rail {
  scroll-padding-inline: 6rem;
  /* Rails scrolled out of the viewport skip layout/paint entirely. The
     intrinsic block size (card 360px + pt-4/pb-6 at tv-ui font scaling)
     keeps the page height stable; `auto` remembers the real size once
     rendered. Focus into a skipped rail forces rendering (focusable =
     relevant to user), verified on-device (Task 7). */
  content-visibility: auto;
  contain-intrinsic-block-size: auto 420px;
}
```

- [ ] **Step 3: Tests laufen lassen**

Run: `pnpm --filter @lolarr/ui test`
Expected: PASS (tokens-Test grün, alle anderen unverändert grün — jsdom wertet CSS nicht aus, Component-Tests unberührt).

- [ ] **Step 4: Visuelle Stichprobe im Web-Preview**

Home laden: Rails unterhalb des Folds erscheinen beim Runterscrollen ohne Layout-Sprünge; Fokus-Wandern Runter über alle Rails landet korrekt (Fokus-Memory + Peek-Scroll wie vorher); Karten-Glow wird nicht geclippt (war schon vorher vom Rail-Overflow geclippt — keine Veränderung erwartet).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/theme.css packages/ui/tests/tokens.test.tsx
git commit -m "perf(ui): css containment on cards + content-visibility on rails"
```

---

### Task 6: Bilder — `decoding="async"` + DPR-bewusste Postergröße

**Files:**
- Modify: `packages/ui/src/components/MediaPosterButton.tsx:65,98,105` (drei `<img>`)
- Modify: `packages/ui/src/components/EpisodeList.tsx:37` (ein `<img>`)
- Modify: `packages/features/src/lib/images.ts`
- Test: `packages/ui/tests/MediaPosterButton.test.tsx`, `packages/features/tests/images.test.ts` (neu)

**Interfaces:**
- Consumes: `buildImageUrl(session, itemId, type, tag, { width })` aus `@lolarr/jellyfin` (setzt `fillWidth`); CSS-Tokens `--card-w: 240px` / `--card-w-expanded: 640px`.
- Produces: `resolveItemImages` fordert Poster mit `240 × min(devicePixelRatio, 2)` an (TV/DPR 1: 240 statt 400 → ~2,8× weniger Decode-Pixel pro Karte). **Backdrop bleibt 1280** — er wird vom Hero (Viewport-breit) mitbenutzt; 640 wäre dort sichtbarer Qualitätsverlust (Spec: Backdrop bleibt). Hero-`<img>` bleibt eager ohne `decoding`-Änderung.

- [ ] **Step 1: Failing Tests — decoding-Attribut**

In `packages/ui/tests/MediaPosterButton.test.tsx` anfügen:

```tsx
  it('decodes card images off the main thread', () => {
    const { container } = render(
      <MediaPosterButton item={item} onOpen={() => {}} Action={DefaultAction} focusKeyPrefix="row" />,
    )
    const imgs = Array.from(container.querySelectorAll('img'))
    expect(imgs.length).toBeGreaterThan(0)
    for (const img of imgs) {
      expect(img.getAttribute('decoding')).toBe('async')
    }
  })
```

Run: `pnpm --filter @lolarr/ui test tests/MediaPosterButton.test.tsx`
Expected: FAIL.

- [ ] **Step 2: `decoding="async"` setzen**

In `packages/ui/src/components/MediaPosterButton.tsx` bei allen drei `<img>`-Tags (Zeilen 65, 98, 105) und in `packages/ui/src/components/EpisodeList.tsx:37` jeweils `decoding="async"` neben `loading="lazy"` ergänzen, z. B.:

```tsx
<img src={item.posterUrl} alt="" loading="lazy" decoding="async" className="lolarr-poster" />
```

Run: `pnpm --filter @lolarr/ui test`
Expected: PASS.

- [ ] **Step 3: Failing Test — Postergröße**

`packages/features/tests/images.test.ts` (neu):

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JellyfinSession, MediaItem } from '@lolarr/domain'
import { resolveItemImages } from '../src/lib/images.js'

const session: JellyfinSession = {
  url: 'https://jf.example',
  accessToken: 't',
  userId: 'u',
  deviceId: 'd',
}

const item = {
  id: '1',
  title: 'X',
  mediaType: 'movie',
  availability: 'available',
  posterUrl: 'fallback-p.jpg',
  backdropUrl: 'fallback-b.jpg',
  jellyfin: {
    itemId: 'jf1',
    imageTags: { primary: 'tag-p', backdrop: 'tag-b' },
  },
} as unknown as MediaItem

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resolveItemImages', () => {
  it('requests the poster at card width on a 1x display (TV)', () => {
    vi.stubGlobal('devicePixelRatio', 1)
    const { posterUrl } = resolveItemImages(item, session)
    expect(posterUrl).toContain('fillWidth=240')
  })

  it('requests the poster at 2x card width on a retina display, capped at 2x', () => {
    vi.stubGlobal('devicePixelRatio', 3)
    const { posterUrl } = resolveItemImages(item, session)
    expect(posterUrl).toContain('fillWidth=480')
  })

  it('keeps the backdrop at 1280 (shared with the viewport-wide hero)', () => {
    vi.stubGlobal('devicePixelRatio', 1)
    const { backdropUrl } = resolveItemImages(item, session)
    expect(backdropUrl).toContain('fillWidth=1280')
  })

  it('passes through fallback urls without a session', () => {
    const { posterUrl, backdropUrl } = resolveItemImages(item, null)
    expect(posterUrl).toBe('fallback-p.jpg')
    expect(backdropUrl).toBe('fallback-b.jpg')
  })
})
```

Run: `pnpm --filter @lolarr/features test tests/images.test.ts`
Expected: FAIL (`fillWidth=400` statt 240/480).

- [ ] **Step 4: `images.ts` anpassen**

`packages/features/src/lib/images.ts` — neue Fassung:

```ts
import type { JellyfinSession, MediaItem } from '@lolarr/domain'
import { buildImageUrl } from '@lolarr/jellyfin'

// Posters render at --card-w (240px CSS). Request device pixels, capped at
// 2x: the TV (DPR 1) decodes 240px instead of the previous fixed 400px.
// Backdrops stay at 1280: the same URL feeds the viewport-wide hero, where
// anything smaller is a visible quality loss (expanded card at 640px CSS
// gets an exact 2x source out of it).
const POSTER_CSS_WIDTH = 240
const BACKDROP_WIDTH = 1280

function posterWidth(): number {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  return Math.round(POSTER_CSS_WIDTH * Math.min(dpr, 2))
}

export function resolveItemImages(
  item: MediaItem,
  session: JellyfinSession | null,
): { posterUrl?: string; backdropUrl?: string } {
  if (!item.jellyfin || !session) {
    return { posterUrl: item.posterUrl, backdropUrl: item.backdropUrl }
  }

  const { itemId, imageTags } = item.jellyfin
  return {
    posterUrl: imageTags.primary
      ? buildImageUrl(session, itemId, 'Primary', imageTags.primary, { width: posterWidth() })
      : item.posterUrl,
    backdropUrl: imageTags.backdrop
      ? buildImageUrl(session, itemId, 'Backdrop', imageTags.backdrop, { width: BACKDROP_WIDTH })
      : item.backdropUrl,
  }
}

export function enrichItems(items: MediaItem[], session: JellyfinSession | null): MediaItem[] {
  return items.map((item) => ({ ...item, ...resolveItemImages(item, session) }))
}
```

- [ ] **Step 5: Tests laufen lassen**

Run: `pnpm --filter @lolarr/features test && pnpm --filter @lolarr/ui test`
Expected: PASS. (Geprüft: kein bestehender Test assertet `fillWidth=400`; der `buildImageUrl`-Test in `packages/jellyfin/tests/index.test.ts:36` testet die Paket-API mit eigenem Wert und ist unberührt.)

- [ ] **Step 6: Visuelle Stichprobe**

Web-Preview (Retina-Display): Poster in Rails scharf wie vorher (480 ≥ vorherige 400). DevTools-Network: Poster-Requests tragen `fillWidth=480` (bzw. 240 bei DPR 1), Hero-Backdrop weiter `fillWidth=1280`.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/components/MediaPosterButton.tsx packages/ui/src/components/EpisodeList.tsx packages/features/src/lib/images.ts packages/features/tests/images.test.ts packages/ui/tests/MediaPosterButton.test.tsx
git commit -m "perf(images): async decode + dpr-sized posters (240px on tv instead of 400px)"
```

---

### Task 7: Nachher-Messung, On-Device-Smoke, Phase-2-Gate

**Files:**
- Modify: ggf. `apps/tv/README.md` (Smoke-Checkliste ergänzen, falls dort die Slice-5-Checkliste lebt — sonst PR-Beschreibung)

**Interfaces:**
- Consumes: Baseline-Traces aus Task 1.
- Produces: Vorher/Nachher-Vergleich in der PR-Beschreibung + dokumentierte Phase-2-Entscheidung.

- [ ] **Step 1: Nachher-Traces (identisches Protokoll wie Task 1)**

Gleiche drei Szenarien, gleiches 6×-Throttle, gleiche Rail. Erwartung: Szenario 2 (Rattern) ohne Layout-Kaskade (Transitions aus + Cache), Szenario 3 deutlich weniger Layout-Anteil; Szenario 1 (einzelner Morph) zeigt weiterhin Rail-Reflow durch die `width`-Transition — dessen Frame-Zeiten entscheiden das Gate.

- [ ] **Step 2: On-Device-Smoke auf dem S94C**

Tizen-Build deployen: `pnpm --filter @lolarr/tv tizen:sync` (baut `vite.tizen.config.ts`-Bundle und kopiert es nach `apps/tv/tizen/`), dann per Tizen Studio/CLI paketieren + auf den S94C installieren (bestehender Slice-5-Flow). Checkliste:

1. Langsame Navigation: Morph animiert, Endzustand identisch zu vorher.
2. Taste halten über lange Rail: Karten snappen, kein Nachhinken des Fokus.
3. 5+ Rails vertikal durchwandern: Fokus landet korrekt, Rails unterhalb des Folds erscheinen korrekt (content-visibility!), Fokus-Memory je Rail funktioniert.
4. Snake (Rechts am Rail-Ende) und Zurück-aus-Rail (Hoch zu Hero/Nav) unverändert.
5. Poster-Schärfe auf dem Gerät unverändert (240px-Quelle auf 240px-Slot bei DPR 1).
6. Norigin-Throttle 100 ms: Links/Rechts innerhalb der Rail fühlt sich nicht laggy an — sonst Wert senken (50) und neu deployen.

- [ ] **Step 3: Phase-2-Gate entscheiden + dokumentieren**

Kriterium aus der Spec: zeigt der **ruhige Morph** (Szenario 1) on-device weiterhin sichtbaren Jank bzw. im Trace Frame-Zeiten > ~33 ms durch Rail-Layout → Phase 2 (Compositor-Morph) als eigener Plan aus der Spec ableiten. Sonst: Slice endet hier, Entscheidung + Zahlen in die PR-Beschreibung.

- [ ] **Step 4: Vorher/Nachher in PR-Beschreibung, Branch pushen**

```bash
git push -u origin feat/tv-rail-performance
```

PR anlegen (Titel: `perf(tv): smooth rail navigation — phase 1 quick wins`), Beschreibung: Tabelle je Szenario (längste Frame-Zeit, Layout-Anteil vorher/nachher), On-Device-Checklisten-Ergebnis, Phase-2-Entscheidung mit Begründung.
