# Web-Pfeiltasten-Navigation + geteilter Scroll-Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Web-Build (`apps/web`) per Pfeiltasten navigierbar machen (additiv zur gleichberechtigten Maus) und das Auto-Scroll-Verhalten von Web **und** TV über einen geteilten, Norigin-freien Helper polieren.

**Architecture:** Norigin Spatial Navigation wird über den bestehenden `LolarrApp`-Injection-Seam auch im Web verdrahtet (`WebAction`/`WebShell`/`WebOverlayScope`/`WebTextInput` in `apps/web`, Spiegel der TV-Seite). Ein geteilter, reiner-DOM-Helper (`packages/ui/src/lib/focusScroll.ts`) kapselt Modalitäts-Tracking (Maus vs. Tastatur) + Anker-Scroll (`data-focus-scroll-region` → Hero ganz; sonst Row zentriert + Peek via `scroll-padding`); `WebAction` und `TvAction` nutzen ihn.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Base UI, `@noriginmedia/norigin-spatial-navigation-core@^4.0.0` + `-react@^3.2.1`, Vitest + jsdom + Testing Library, moon/pnpm-Monorepo.

## Global Constraints

- Zielkontext: **Desktop Maus+Tastatur**. Kein 10-Foot-/Back-Tasten-Ziel; Maus bleibt jederzeit gleichberechtigt (Hover, Klick).
- `packages/ui` bekommt **keine** Norigin-Abhängigkeit — `focusScroll.ts` ist reines DOM (kein Norigin-Import). Norigin lebt nur in `apps/web` + `apps/tv`.
- `apps/web/package.json` bekommt exakt `@noriginmedia/norigin-spatial-navigation-core: "^4.0.0"` und `@noriginmedia/norigin-spatial-navigation-react: "^3.2.1"` (identisch zu `apps/tv`).
- Norigin-Web-Init: `shouldFocusDOMNode: true`, `domNodeFocusOptions: { preventScroll: true }`, `throttle: 0`, `throttleKeypresses: true`, `distanceCalculationMethod: 'corners'`.
- `WebAction` setzt die `.focused`-Klasse **nur bei Keyboard-Modalität** (`focused && isKeyboardModality()`). `TvAction` behält `.focused` unbedingt (TV ist immer Tastatur/Fernbedienung).
- Scroll-`behavior`: `smooth` im Web, `auto` (instant) auf TV; **immer** `auto` bei `prefers-reduced-motion: reduce`.
- Nav-Clearance = `--nav-h: 6rem` (96px, matcht `<main class="pt-24">` / Hero `-mt-24`). Rail-Peek `scroll-padding-inline: 6rem`.
- Vertikaler Scroll-Container ist das **Dokument** → `scroll-padding-block-start` gehört auf **`html`** (nicht `<main>`).
- Web-Dev/Preview-Port **5199** (`--strictPort`).
- **Nicht committen:** `apps/tv/tizen/assets/*` (pre-existing, uncommitted) und `graphify-out/`.
- DRY, YAGNI, TDD, häufige Commits. Tests: `pnpm --filter @lolarr/ui test` bzw. `moon run ui:test`; `moon run :typecheck`; `moon run :lint`.
- ⛔ Nach Task 5 (TV-Vereinheitlichung) ist eine **TV-On-Device-Abnahme** des Scroll-Gefühls Pflicht-Gate.

---

## File Structure

**Neu:**
- `packages/ui/src/lib/focusScroll.ts` — geteiltes Modalitäts- + Anker-Scroll-Modul (reines DOM).
- `packages/ui/tests/focusScroll.test.ts` — Unit-Tests dazu.
- `packages/ui/tests/MediaRail.test.tsx` — Test für die `lolarr-rail`-Klasse.
- `apps/web/src/spatial-navigation.ts` — Norigin-Init (Web-Config).
- `apps/web/src/focus/WebAction.tsx` — fokussierbares `ActionComponent`.
- `apps/web/src/focus/WebShell.tsx` — Fokus-Root + `WebOverlayScope` + Modalitäts-Tracking.
- `apps/web/src/focus/WebTextInput.tsx` — Textfeld mit `pause()`/`resume()`.

**Geändert:**
- `packages/ui/src/index.ts` — `focusScroll`-Exporte.
- `packages/ui/src/theme.css` — `--nav-h`, `html { scroll-padding-block-start }`, `.lolarr-rail`.
- `packages/ui/src/components/MediaRail.tsx` — `lolarr-rail`-Klasse am Scroll-`div`.
- `packages/ui/src/components/HeroPanel.tsx` — `data-focus-scroll-region` an beiden `<section>`.
- `packages/ui/src/components/DetailPanel.tsx` — `data-focus-scroll-region` am `<section>`.
- `packages/ui/tests/HeroPanel.test.tsx`, `packages/ui/tests/DetailPanel.test.tsx` — Region-Assertions.
- `apps/web/package.json` — Norigin-Deps.
- `apps/web/src/main.tsx` — Init-Aufruf.
- `apps/web/src/App.tsx` — `WebAction`/`WebShell`/`WebTextInput` injizieren.
- `apps/tv/src/App.tsx` — geteilten Helper nutzen, lokale Funktion entfernen, Modalitäts-Tracking installieren.
- `packages/ui/README.md` bzw. `README.md` — Kurz-Doku (Task 6).

---

## Task 1: Geteilter `focusScroll`-Helper (packages/ui)

**Files:**
- Create: `packages/ui/src/lib/focusScroll.ts`
- Modify: `packages/ui/src/index.ts:37` (nach `export * from './lib/icons'`)
- Test: `packages/ui/tests/focusScroll.test.ts`

**Interfaces:**
- Produces:
  - `isKeyboardModality(): boolean`
  - `installModalityTracking(): () => void`
  - `scrollFocusedIntoView(element: Element | null, options?: { smooth?: boolean }): void`

- [ ] **Step 1: Failing test schreiben** — `packages/ui/tests/focusScroll.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  installModalityTracking,
  isKeyboardModality,
  scrollFocusedIntoView,
} from '@ui/lib/focusScroll'

let cleanup: () => void
let scrollSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  // rAF synchron ausführen → deterministische Assertions.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  })
  // jsdom hat kein matchMedia; Standard: Bewegung erlaubt.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false
    },
  }))
  scrollSpy = vi.fn()
  Element.prototype.scrollIntoView =
    scrollSpy as unknown as typeof Element.prototype.scrollIntoView
  cleanup = installModalityTracking()
})

afterEach(() => {
  cleanup()
  // Modalität zwischen Tests auf Default (Pointer) zurücksetzen.
  window.dispatchEvent(new Event('pointerdown'))
  vi.unstubAllGlobals()
})

describe('modality tracking', () => {
  it('startet nicht-Tastatur und kippt bei keydown / zurück bei pointer', () => {
    window.dispatchEvent(new Event('pointerdown'))
    expect(isKeyboardModality()).toBe(false)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(isKeyboardModality()).toBe(true)

    window.dispatchEvent(new Event('pointermove'))
    expect(isKeyboardModality()).toBe(false)
  })
})

describe('scrollFocusedIntoView', () => {
  it('scrollt nicht unter Pointer-Modalität', () => {
    window.dispatchEvent(new Event('pointerdown'))
    const el = document.createElement('div')
    scrollFocusedIntoView(el, { smooth: true })
    expect(scrollSpy).not.toHaveBeenCalled()
  })

  it('zeigt die ganze Hero-Region oben (block:start)', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
    const region = document.createElement('section')
    region.setAttribute('data-focus-scroll-region', '')
    const button = document.createElement('button')
    region.appendChild(button)
    document.body.appendChild(region)

    scrollFocusedIntoView(button, { smooth: true })

    expect(scrollSpy).toHaveBeenCalledTimes(1)
    expect(scrollSpy.mock.instances[0]).toBe(region)
    expect(scrollSpy).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
  })

  it('zentriert eine Rail-Card + horizontaler Nudge', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    const card = document.createElement('button')
    document.body.appendChild(card)

    scrollFocusedIntoView(card, { smooth: true })

    expect(scrollSpy).toHaveBeenCalledWith({
      block: 'center',
      inline: 'nearest',
      behavior: 'smooth',
    })
  })

  it('instant bei prefers-reduced-motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false
      },
    }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    const card = document.createElement('button')
    document.body.appendChild(card)

    scrollFocusedIntoView(card, { smooth: true })

    expect(scrollSpy).toHaveBeenCalledWith({
      block: 'center',
      inline: 'nearest',
      behavior: 'auto',
    })
  })

  it('instant wenn smooth nicht angefragt (TV)', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    const card = document.createElement('button')
    document.body.appendChild(card)

    scrollFocusedIntoView(card, { smooth: false })

    expect(scrollSpy).toHaveBeenCalledWith({
      block: 'center',
      inline: 'nearest',
      behavior: 'auto',
    })
  })
})
```

- [ ] **Step 2: Test rot laufen** — Run: `pnpm --filter @lolarr/ui test focusScroll`
  Expected: FAIL — `Cannot find module '@ui/lib/focusScroll'`.

- [ ] **Step 3: Helper implementieren** — `packages/ui/src/lib/focusScroll.ts`:

```ts
// Geteiltes, Norigin-freies Modalitäts- + Anker-Scroll-Modul. Von WebAction
// (Web) und TvAction (TV) genutzt. Bewusst abhängigkeitsfrei (reines DOM), damit
// packages/ui die Spatial-Navigation-Lib nie importiert.

let keyboardModality = false

function markKeyboard() {
  keyboardModality = true
}

function markPointer() {
  keyboardModality = false
}

export function isKeyboardModality(): boolean {
  return keyboardModality
}

// Fenster-Listener: verfolgt, ob die letzte Eingabe Tastatur (Pfeil/Fernbedienung)
// oder Pointer (Maus) war. Gibt Cleanup zurück. WebShell und TvShell rufen das
// je einmal beim Mount. Auf TV gibt es keine Pointer-Events → die erste
// Fernbedienungstaste kippt das Flag auf true und es bleibt true.
export function installModalityTracking(): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  window.addEventListener('keydown', markKeyboard, true)
  window.addEventListener('pointerdown', markPointer, true)
  window.addEventListener('pointermove', markPointer, true)

  return () => {
    window.removeEventListener('keydown', markKeyboard, true)
    window.removeEventListener('pointerdown', markPointer, true)
    window.removeEventListener('pointermove', markPointer, true)
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

// Bringt das fokussierte Element mit konsistentem Anker in den Blick:
//  - innerhalb eines [data-focus-scroll-region] (der Hero): die ganze Region
//    oben zeigen (block:'start'), respektiert scroll-padding-block-start.
//  - sonst (Rail-Card/Row): Reihe zentrieren (block:'center') + horizontal zur
//    nächsten Kante (inline:'nearest'); die scroll-padding-inline der Rail lässt
//    einen Peek der Nachbar-Card.
// Scrollt nur, wenn die letzte Eingabe Tastatur/Fernbedienung war — Maus-Hover
// reißt die Seite nie weg.
export function scrollFocusedIntoView(
  element: Element | null,
  options: { smooth?: boolean } = {},
): void {
  if (!element || !isKeyboardModality() || typeof window === 'undefined') {
    return
  }

  const behavior: ScrollBehavior =
    options.smooth && !prefersReducedMotion() ? 'smooth' : 'auto'

  window.requestAnimationFrame(() => {
    const region = element.closest('[data-focus-scroll-region]')

    try {
      if (region) {
        region.scrollIntoView({ block: 'start', behavior })
        return
      }

      element.scrollIntoView({ block: 'center', inline: 'nearest', behavior })
    } catch {
      element.scrollIntoView(false)
    }
  })
}
```

- [ ] **Step 4: Export ergänzen** — in `packages/ui/src/index.ts` nach Zeile 37 (`export * from './lib/icons'`) einfügen:

```ts
export * from './lib/focusScroll'
```

- [ ] **Step 5: Test grün laufen** — Run: `pnpm --filter @lolarr/ui test focusScroll`
  Expected: PASS (6 Tests).

- [ ] **Step 6: Typecheck** — Run: `moon run ui:typecheck`
  Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/lib/focusScroll.ts packages/ui/tests/focusScroll.test.ts packages/ui/src/index.ts
git commit -m "feat(ui): shared Norigin-free focus-scroll + modality helper"
```

---

## Task 2: Scroll-Anker-Flächen (theme.css + Region-Attribute + Rail-Klasse)

**Files:**
- Modify: `packages/ui/src/theme.css:57` (`:root`-Ende, nach `--danger`), `packages/ui/src/theme.css:106-115` (`@layer base > html`)
- Modify: `packages/ui/src/components/MediaRail.tsx:26`
- Modify: `packages/ui/src/components/HeroPanel.tsx:26,37`
- Modify: `packages/ui/src/components/DetailPanel.tsx:41`
- Test: `packages/ui/tests/MediaRail.test.tsx` (neu), `packages/ui/tests/HeroPanel.test.tsx`, `packages/ui/tests/DetailPanel.test.tsx`

**Interfaces:**
- Consumes: `scrollFocusedIntoView` liest `element.closest('[data-focus-scroll-region]')` (Task 1) und den `scroll-padding`-Anker.
- Produces: DOM-Vertrag — Hero-Wrapper tragen `data-focus-scroll-region`; Rail-Scroller trägt `lolarr-rail`.

- [ ] **Step 1: Failing tests schreiben.**

Neu `packages/ui/tests/MediaRail.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { MediaItem } from '@lolarr/domain'
import { MediaRail } from '@ui/components/MediaRail'
import { DefaultAction } from '@ui/components/DefaultAction'

afterEach(cleanup)

const items = [
  { id: '1', title: 'A', posterUrl: 'a.jpg', mediaType: 'movie', availability: 'available' },
] as unknown as MediaItem[]

describe('MediaRail', () => {
  it('markiert den horizontalen Scroller als lolarr-rail (scroll-padding-Anker)', () => {
    const { container } = render(
      <MediaRail id="row" title="Row" items={items} onOpen={() => {}} Action={DefaultAction} />,
    )
    const rail = container.querySelector('.lolarr-rail')
    expect(rail).toBeTruthy()
    expect(rail?.className).toContain('overflow-x-auto')
  })
})
```

In `packages/ui/tests/HeroPanel.test.tsx` innerhalb `describe('HeroPanel', ...)` ergänzen:

```tsx
  it('markiert den Hero-Wrapper als Scroll-Region (ganzer Hero bei Fokus)', () => {
    const { container } = render(
      <HeroPanel item={item} onOpen={() => {}} onPlay={() => {}} Action={DefaultAction} />,
    )
    expect(container.querySelector('[data-focus-scroll-region]')).toBeTruthy()
  })
```

In `packages/ui/tests/DetailPanel.test.tsx` innerhalb des `describe('DetailPanel', ...)`-Blocks ergänzen (nutzt das dort vorhandene `requestableItem`-Fixture und `DefaultAction`):

```tsx
  it('markiert den Detail-Wrapper als Scroll-Region', () => {
    const { container } = render(
      <DetailPanel
        item={requestableItem}
        onBack={() => {}}
        onRequest={() => {}}
        Action={DefaultAction}
      />,
    )
    expect(container.querySelector('[data-focus-scroll-region]')).toBeTruthy()
  })
```

- [ ] **Step 2: Tests rot laufen** — Run: `pnpm --filter @lolarr/ui test MediaRail HeroPanel DetailPanel`
  Expected: FAIL — `.lolarr-rail` bzw. `[data-focus-scroll-region]` nicht gefunden.

- [ ] **Step 3: `--nav-h`-Token ergänzen** — in `packages/ui/src/theme.css` in `:root` direkt nach `--danger: #d97b7b;` (Zeile 57):

```css
  /* Höhe der fixen Top-Nav-Clearance (matcht <main class="pt-24"> / Hero -mt-24) */
  --nav-h: 6rem;
```

- [ ] **Step 4: `html`-Scroll-Padding ergänzen** — im `@layer base`-`html`-Block (`packages/ui/src/theme.css`, ab Zeile 111) innerhalb der bestehenden `html { ... }`-Regel ergänzen (das Dokument ist der vertikale Scroll-Container):

```css
    scroll-padding-block-start: var(--nav-h);
```

- [ ] **Step 5: `.lolarr-rail`-Regel ergänzen** — in `packages/ui/src/theme.css` bei den übrigen `.lolarr-*`-Regeln (nach dem Card-Block, außerhalb der `@layer`) einfügen:

```css
/* Rail-Scroller: hält die fokussierte Card mit sichtbarem Peek der Nachbar-Card
   von der Kante weg (statt bündig), respektiert von scrollFocusedIntoView. */
.lolarr-rail {
  scroll-padding-inline: 6rem;
}
```

- [ ] **Step 6: `lolarr-rail`-Klasse an MediaRail** — in `packages/ui/src/components/MediaRail.tsx` Zeile 26 `className` voranstellen:

```tsx
      <div className="lolarr-rail flex gap-5 overflow-x-auto pl-12 pr-12 pt-4 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
```

- [ ] **Step 7: `data-focus-scroll-region` an HeroPanel** — in `packages/ui/src/components/HeroPanel.tsx` beide `<section className={HERO_SHELL}>` (Loading-Branch Zeile 26 und Haupt-Branch Zeile 37) ergänzen:

```tsx
    <section className={HERO_SHELL} data-focus-scroll-region>
```

- [ ] **Step 8: `data-focus-scroll-region` an DetailPanel** — in `packages/ui/src/components/DetailPanel.tsx` Zeile 41:

```tsx
    <section className="flex flex-col gap-8" data-focus-scroll-region>
```

- [ ] **Step 9: Tests grün laufen** — Run: `pnpm --filter @lolarr/ui test`
  Expected: PASS — alle bestehenden + neuen Tests grün (MediaRail/HeroPanel/DetailPanel-Region).

- [ ] **Step 10: Commit**

```bash
git add packages/ui/src/theme.css packages/ui/src/components/MediaRail.tsx packages/ui/src/components/HeroPanel.tsx packages/ui/src/components/DetailPanel.tsx packages/ui/tests/MediaRail.test.tsx packages/ui/tests/HeroPanel.test.tsx packages/ui/tests/DetailPanel.test.tsx
git commit -m "feat(ui): scroll-anchor surfaces — nav-h scroll-padding, rail peek, hero scroll-region"
```

---

## Task 3: Web-Norigin-Bootstrap + WebAction + WebShell

**Files:**
- Modify: `apps/web/package.json:13-18` (dependencies)
- Create: `apps/web/src/spatial-navigation.ts`
- Create: `apps/web/src/focus/WebAction.tsx`
- Create: `apps/web/src/focus/WebShell.tsx`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `scrollFocusedIntoView`, `isKeyboardModality`, `installModalityTracking`, `Button`, `cn`, `OverlayScopeProvider`, `ActionProps`, `ShellProps` (alle aus `@lolarr/ui`); `useFocusable`, `FocusContext` (`-react`); `init` (`-core`, nur in `spatial-navigation.ts`). Der Maus-Sync nutzt `focusSelf()` aus `useFocusable` (kein `setFocus`).
- Produces: `WebAction` (`ActionComponent`), `WebShell` (`ComponentType<ShellProps>`).

Hinweis Verifikation: `apps/web` hat kein Vitest-Harness; `WebAction`/`WebShell` sind dünne Norigin-Verdrahtung (wie `TvAction` heute, ebenfalls ohne Unit-Test). Die testbare Logik liegt bereits in Task 1. Diese Task wird per `typecheck` + `build` + Preview-Smoke (Port 5199) verifiziert.

- [ ] **Step 1: Norigin-Deps ergänzen** — in `apps/web/package.json` den `dependencies`-Block auf folgenden Stand bringen:

```json
  "dependencies": {
    "@lolarr/features": "workspace:*",
    "@lolarr/ui": "workspace:*",
    "@noriginmedia/norigin-spatial-navigation-core": "^4.0.0",
    "@noriginmedia/norigin-spatial-navigation-react": "^3.2.1",
    "react": "^19.2.7",
    "react-dom": "^19.2.7"
  },
```

- [ ] **Step 2: Install** — Run: `pnpm install`
  Expected: Lockfile aktualisiert, `@lolarr/web` verlinkt die beiden Norigin-Pakete (bereits im Workspace vorhanden).

- [ ] **Step 3: Init erstellen** — `apps/web/src/spatial-navigation.ts`:

```ts
import { init as initSpatialNavigation } from '@noriginmedia/norigin-spatial-navigation-core'

let isSpatialNavigationInitialized = false

export function initializeSpatialNavigation() {
  if (isSpatialNavigationInitialized || typeof window === 'undefined') {
    return
  }

  initSpatialNavigation({
    debug: false,
    visualDebug: false,
    throttle: 0,
    // Gehaltene Pfeiltaste sauber wiederholen (Desktop-Autorepeat).
    throttleKeypresses: true,
    // Echter DOM-Fokus → :focus-visible + a11y + natives Enter/Klick.
    shouldFocusDOMNode: true,
    // Norigins Fokus soll NICHT nativ scrollen — wir kontrollieren Scroll selbst
    // über den geteilten focusScroll-Helper.
    domNodeFocusOptions: { preventScroll: true },
    distanceCalculationMethod: 'corners',
  })

  isSpatialNavigationInitialized = true
}
```

- [ ] **Step 4: WebAction erstellen** — `apps/web/src/focus/WebAction.tsx`:

```tsx
import { useEffect } from 'react'
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation-react'
import {
  Button,
  cn,
  isKeyboardModality,
  scrollFocusedIntoView,
  type ActionProps,
} from '@lolarr/ui'

export function WebAction({
  ariaLabel,
  autoFocus,
  children,
  className = '',
  disabled,
  focusKey,
  onPress,
  size,
  type = 'button',
  variant,
}: ActionProps) {
  const { ref, focused, focusSelf } = useFocusable({
    focusKey,
    focusable: !disabled,
    onEnterPress: () => {
      if (onPress) {
        onPress()
        return
      }
      const button = ref.current as HTMLButtonElement | null
      button?.click()
    },
  })

  // Overlay-Primärbutton beim Öffnen fokussieren (Base UIs Auto-Focus ist aus,
  // damit Norigin die Fokus-Hoheit behält — analog TvAction).
  useEffect(() => {
    if (autoFocus) {
      focusSelf()
    }
  }, [autoFocus, focusSelf])

  // Bei Fokuswechsel scrollen — der Helper scrollt nur unter Keyboard-Modalität.
  useEffect(() => {
    if (focused) {
      scrollFocusedIntoView(ref.current, { smooth: true })
    }
  }, [focused, ref])

  return (
    <Button
      ref={ref}
      type={type}
      variant={variant}
      size={size}
      aria-label={ariaLabel}
      // .focused NUR bei Tastatur → Maus-Hover expandiert via :hover (kollabiert
      // beim Verlassen) statt die persistente .focused-Klasse kleben zu lassen.
      className={cn(className, focused && isKeyboardModality() && 'focused')}
      disabled={disabled}
      onClick={onPress}
      // Maus↔Tastatur-Sync: Hover verschiebt Norigins aktuellen Knoten hierher,
      // sodass Pfeiltasten von der gehoverten Card weiternavigieren. Kein Scroll
      // (Pointer-Modalität), kein .focused (siehe className).
      onPointerEnter={() => {
        if (!disabled) {
          focusSelf()
        }
      }}
    >
      {children}
    </Button>
  )
}
```

- [ ] **Step 5: WebShell + WebOverlayScope erstellen** — `apps/web/src/focus/WebShell.tsx`:

```tsx
import { useEffect, type ReactNode } from 'react'
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation-react'
import { OverlayScopeProvider, installModalityTracking, type ShellProps } from '@lolarr/ui'

// Norigin-Fokus-Boundary für offene Dialoge — Pfeiltasten bleiben im Dialog
// gefangen (ergänzt Base UIs Tab-Trap). Spiegel von TvOverlayScope.
function WebOverlayScope({ children }: { children: ReactNode }) {
  const { ref, focusKey } = useFocusable({
    isFocusBoundary: true,
    trackChildren: true,
  })

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="contents">
        {children}
      </div>
    </FocusContext.Provider>
  )
}

export function WebShell({ children }: ShellProps) {
  const { ref, focusKey, focusSelf } = useFocusable({
    focusKey: 'APP',
    trackChildren: true,
  })

  // Modalitäts-Tracking installieren (Maus vs. Tastatur) für den Scroll-Guard.
  useEffect(() => installModalityTracking(), [])

  // Fokus beim Mount seeden. Kein Streu-Ring für Maus-Nutzer: :focus-visible
  // triggert nur bei Tastatur, und WebAction gated .focused auf Keyboard-
  // Modalität (beim Mount = false) → sichtbarer Ring erst ab der ersten Taste.
  useEffect(() => {
    focusSelf()
  }, [focusSelf])

  return (
    <OverlayScopeProvider value={WebOverlayScope}>
      <FocusContext.Provider value={focusKey}>
        <div ref={ref} className="app-shell">
          {children}
        </div>
      </FocusContext.Provider>
    </OverlayScopeProvider>
  )
}
```

- [ ] **Step 6: Init verdrahten** — `apps/web/src/main.tsx` auf folgenden Stand (Init vor `render`, analog `apps/tv`):

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@lolarr/ui/theme.css'
import App from './App.tsx'
import { initializeSpatialNavigation } from './spatial-navigation'

initializeSpatialNavigation()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 7: App injizieren** — `apps/web/src/App.tsx` auf folgenden Stand:

```tsx
import { LolarrApp } from '@lolarr/features'
import { WebAction } from './focus/WebAction'
import { WebShell } from './focus/WebShell'
import { WebTextInput } from './focus/WebTextInput'

function App() {
  return <LolarrApp Action={WebAction} Shell={WebShell} TextInput={WebTextInput} />
}

export default App
```

Hinweis: `WebTextInput` entsteht in Task 4. Damit `apps/web` zwischen Task 3 und 4 typcheckt/baut, in **diesem** Task vorübergehend `TextInput` weglassen (Default `DefaultTextInput` greift):

```tsx
  return <LolarrApp Action={WebAction} Shell={WebShell} />
```

Der `WebTextInput`-Import wird in Task 4 ergänzt.

- [ ] **Step 8: Typecheck + Build** — Run: `moon run web:typecheck && moon run web:build`
  Expected: PASS.

- [ ] **Step 9: Preview-Smoke (Port 5199).** Dev-Server starten (`.claude/launch.json` → `web`) und prüfen:
  - `ArrowRight`/`ArrowLeft` bewegt den Fokus durch eine Home-Rail; die fokussierte Card zeigt Ring/Expand; die Seite hält die Reihe zentriert; horizontaler Peek sichtbar.
  - `ArrowUp` auf eine Hero-CTA → **ganzer Hero** sichtbar (Seite oben).
  - Maus-Hover über Cards expandiert (via `:hover`), **kein** Seiten-Scroll beim Hover; Card kollabiert beim Verlassen.
  - Klick auf eine Card öffnet Detail (Maus unverändert).
  - Reiner Maus-Start (kein Tastendruck) → **kein** Fokus-Ring.
  - Keine Konsolen-Errors (`preview_console_logs`, level error).

- [ ] **Step 10: Commit**

```bash
git add apps/web/package.json apps/web/src/spatial-navigation.ts apps/web/src/focus/WebAction.tsx apps/web/src/focus/WebShell.tsx apps/web/src/main.tsx apps/web/src/App.tsx pnpm-lock.yaml
git commit -m "feat(web): arrow-key navigation via Norigin — WebAction + WebShell + init"
```

---

## Task 4: WebTextInput (pause/resume beim Tippen)

**Files:**
- Create: `apps/web/src/focus/WebTextInput.tsx`
- Modify: `apps/web/src/App.tsx` (WebTextInput injizieren)

**Interfaces:**
- Consumes: `Input`, `cn`, `TextInputProps` (`@lolarr/ui`); `useFocusable` (`-react`); `pause`, `resume` (`-core`).
- Produces: `WebTextInput` (`TextInputComponent`).

- [ ] **Step 1: WebTextInput erstellen** — `apps/web/src/focus/WebTextInput.tsx`:

```tsx
import { type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { pause, resume } from '@noriginmedia/norigin-spatial-navigation-core'
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation-react'
import { Input, cn, type TextInputProps } from '@lolarr/ui'

export function WebTextInput({
  ariaLabel,
  autoComplete,
  className = '',
  defaultValue,
  enterKeyHint,
  focusKey,
  name,
  nextFocusKey,
  onValueChange,
  placeholder,
  required,
  submitOnEnter,
  type = 'text',
  value,
}: TextInputProps) {
  const { ref } = useFocusable({ focusKey, focusable: true })

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      // Feld verlassen → onBlur resume()t die Spatial-Navigation.
      event.currentTarget.blur()
      return
    }

    if (event.key !== 'Enter') {
      return
    }

    if (nextFocusKey) {
      event.preventDefault()
      const next = document.querySelector<HTMLInputElement>(
        `input[data-focus-key="${nextFocusKey}"]`,
      )
      event.currentTarget.blur()
      next?.focus()
      return
    }

    if (submitOnEnter) {
      event.preventDefault()
      event.currentTarget.blur()
      event.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <Input
      ref={ref}
      aria-label={ariaLabel}
      autoComplete={autoComplete}
      className={cn(className)}
      data-focus-key={focusKey}
      defaultValue={defaultValue}
      enterKeyHint={enterKeyHint}
      name={name}
      onChange={(event) => onValueChange?.(event.currentTarget.value)}
      // Beim Fokus Spatial-Nav pausieren → Pfeile/Home/End bewegen den Cursor,
      // Tippen verschiebt nie das Grid. Blur setzt fort.
      onFocus={() => pause()}
      onBlur={() => resume()}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      required={required}
      type={type}
      value={value}
    />
  )
}
```

- [ ] **Step 2: WebTextInput injizieren** — `apps/web/src/App.tsx` auf den finalen Stand (mit `WebTextInput`) bringen:

```tsx
import { LolarrApp } from '@lolarr/features'
import { WebAction } from './focus/WebAction'
import { WebShell } from './focus/WebShell'
import { WebTextInput } from './focus/WebTextInput'

function App() {
  return <LolarrApp Action={WebAction} Shell={WebShell} TextInput={WebTextInput} />
}

export default App
```

- [ ] **Step 3: Typecheck + Build** — Run: `moon run web:typecheck && moon run web:build`
  Expected: PASS.

- [ ] **Step 4: Preview-Smoke (Port 5199).**
  - In das Suchfeld tabben/klicken → tippen; `ArrowLeft`/`ArrowRight`/`Home`/`End` bewegen den **Cursor**, das Kachel-Grid bewegt sich **nicht**.
  - `Escape` verlässt das Feld; danach navigieren Pfeiltasten wieder die Kacheln.
  - Gateway-Formular: Enter auf einem Feld mit `submitOnEnter` submittet; mit `nextFocusKey` springt der Fokus ins nächste Feld.
  - Keine Konsolen-Errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/focus/WebTextInput.tsx apps/web/src/App.tsx
git commit -m "feat(web): WebTextInput pauses spatial nav while typing"
```

---

## Task 5: TV-Vereinheitlichung (geteilter Scroll-Helper) ⛔ TV-Abnahme

**Files:**
- Modify: `apps/tv/src/App.tsx` (Import, `TvAction`/`TvTextInput`/`activateTextInput`-Scroll-Aufrufe, `TvShell`, lokale Funktion entfernen)

**Interfaces:**
- Consumes: `scrollFocusedIntoView`, `installModalityTracking` (`@lolarr/ui`, Task 1).

- [ ] **Step 1: Import ergänzen** — in `apps/tv/src/App.tsx` den `@lolarr/ui`-Import (aktuell Zeilen 8–15) um die beiden Helfer erweitern:

```tsx
import {
  Button,
  Input,
  OverlayScopeProvider,
  cn,
  installModalityTracking,
  scrollFocusedIntoView,
  type ActionProps,
  type TextInputProps,
} from '@lolarr/ui'
```

- [ ] **Step 2: TvAction-Scroll umstellen** — in `apps/tv/src/App.tsx` den `focused`-Effekt (aktuell Zeilen 55–59) ersetzen:

```tsx
  useEffect(() => {
    if (focused) {
      scrollFocusedIntoView(ref.current, { smooth: false })
    }
  }, [focused, ref])
```

- [ ] **Step 3: TvTextInput-Scroll umstellen** — den `focused`-Effekt (aktuell Zeilen 114–123) auf den geteilten Helper umstellen:

```tsx
  useEffect(() => {
    const input = ref.current as HTMLInputElement | null

    if (focused) {
      scrollFocusedIntoView(input, { smooth: false })
      return
    }

    blurTextInput(input)
  }, [focused, ref])
```

- [ ] **Step 4: activateTextInput-Scroll umstellen** — in `activateTextInput` (aktuell Zeile 264) `scrollFocusedElementIntoView(input)` ersetzen durch:

```tsx
  scrollFocusedIntoView(input, { smooth: false })
```

- [ ] **Step 5: TvShell Modalitäts-Tracking** — im `TvShell` (aktuell Zeilen 213–232) den bestehenden `focusSelf`-Effekt um das Tracking ergänzen (unmittelbar davor einfügen):

```tsx
  useEffect(() => installModalityTracking(), [])
```

(TV hat keine Pointer-Events → die erste Fernbedienungstaste kippt die Modalität auf `true`; der Mount-Seed-Fokus scrollt bewusst noch nicht — das erste Element sitzt links oben.)

- [ ] **Step 6: Lokale Funktion entfernen** — die komplette `scrollFocusedElementIntoView`-Definition (aktuell Zeilen 323–338) aus `apps/tv/src/App.tsx` löschen. Danach darf `scrollFocusedElementIntoView` im File nicht mehr vorkommen.

- [ ] **Step 7: Kein Rest-Vorkommen prüfen** — Run: `grep -n "scrollFocusedElementIntoView" apps/tv/src/App.tsx`
  Expected: keine Treffer.

- [ ] **Step 8: Typecheck + Build** — Run: `moon run tv:typecheck && moon run tv:build`
  Expected: PASS.

- [ ] **Step 9: ⛔ TV-On-Device-Abnahme (Pflicht-Gate).** Am echten Tizen-Gerät prüfen: D-pad bewegt den Fokus; die fokussierte Card/Reihe wird zentriert; Hero-CTA zeigt den ganzen Hero; Scroll ist instant (kein Smooth-Ruckeln auf schwacher Hardware); keine Fokus-Sprünge/Klipp-Fehler. Ergebnis dokumentieren.

- [ ] **Step 10: Commit**

```bash
git add apps/tv/src/App.tsx
git commit -m "refactor(tv): use shared focusScroll helper, drop local scroll fn"
```

---

## Task 6: Doku + Gesamt-Verifikation + Final-Review

**Files:**
- Modify: `packages/ui/README.md` (Abschnitt zum geteilten Fokus-Scroll / Web-Nav)

- [ ] **Step 1: Doku ergänzen** — in `packages/ui/README.md` einen kurzen Abschnitt ergänzen:

```markdown
### Fokus-Navigation & Scroll (Web + TV)

Beide Apps injizieren Norigin-basierte Fokus-Komponenten über den `LolarrApp`-Seam
(`Action`/`Shell`/`TextInput`): TV → `TvAction`/`TvShell`/`TvTextInput`,
Web → `WebAction`/`WebShell`/`WebTextInput` (Desktop Maus+Tastatur, Pfeile additiv).
Das Scroll-/Modalitäts-Verhalten liegt geteilt und Norigin-frei in
`src/lib/focusScroll.ts`:

- `installModalityTracking()` — verfolgt Tastatur vs. Maus (nur Tastatur scrollt).
- `scrollFocusedIntoView(el, { smooth })` — Hero-Wrapper (`data-focus-scroll-region`)
  werden ganz oben gezeigt (`block:'start'`), sonst wird die Reihe zentriert
  (`block:'center'`) mit Peek über die Rail-`scroll-padding-inline`. `smooth` im Web,
  instant auf TV; immer instant bei `prefers-reduced-motion`.
```

- [ ] **Step 2: Gesamt-Tests** — Run: `moon run :test`
  Expected: PASS (ui inkl. neuem `focusScroll` + Region-Tests; features; player).

- [ ] **Step 3: Typecheck + Lint** — Run: `moon run :typecheck && moon run :lint`
  Expected: PASS bzw. keine **neuen** Verstöße (vorbestehende GlassDialog/OverlayScope-react-refresh-Hinweise bleiben unverändert).

- [ ] **Step 4: Web-Preview-Gesamt-Smoke (Port 5199).** Durchgehende Prüfung: Pfeil-Traversierung über Nav ↔ Hero ↔ Rails ↔ Detail; Maus jederzeit gleichberechtigt; Suchfeld-Cursor; Dialog-Trap (Pfeile bleiben im offenen Dialog); Scroll-Anker/Peek/Smooth; reduced-motion (System-Setting) → instant. Screenshot/Netzwerk als Beleg sichern.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/README.md
git commit -m "docs(ui): document shared focus navigation + scroll behavior"
```

- [ ] **Step 6: Final-Review** — Whole-Branch-Review dispatchen (superpowers:requesting-code-review), Findings triagieren, dann `superpowers:finishing-a-development-branch`. **`apps/tv/tizen/assets/*` und `graphify-out/` NICHT committen.**

---

## Notizen / bewusste Entscheidungen

- **`.focused` nur bei Keyboard-Modalität (WebAction):** verhindert, dass Hover die persistente `.focused`-Klasse setzt und Cards nach dem Mausverlassen expandiert bleiben. Hover expandiert via `:hover`, Pfeil-Fokus via `.focused`. Dies präzisiert das Spec-Detail „Maus↔Tastatur-Sync" implementierungsseitig (Sync via `focusSelf()` bleibt erhalten).
- **Mount-Seed statt First-Arrow-Seed (WebShell):** spiegelt `TvShell`; „kein Streu-Ring" wird durch die Modalitäts-Gatung von `.focused` + `:focus-visible`-Heuristik erreicht, nicht durch Zurückhalten des Seeds — vermeidet einen Doppel-Move beim ersten Pfeildruck.
- **TV Mount-Seed scrollt nicht mehr:** durch den Modalitäts-Guard scrollt der erste (Mount-)Fokus auf TV nicht mehr sofort; ab der ersten Fernbedienungstaste wie gehabt. Bewusst; im ⛔-On-Device-Gate abgenommen.
- **`apps/web` ohne Vitest:** `WebAction`/`WebShell`/`WebTextInput` sind dünne Norigin-Adapter (wie `TvAction`), Browser-verifiziert; die testbare Kernlogik lebt in `focusScroll.ts` (Task 1, unit-getestet).
