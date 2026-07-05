# Lolarr UI-Redesign (Abyss-Cinematic) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the existing Slice-7 UI to faithfully match the abyss-jellyfin theme (measured live) in reiverr's layout — cinematic, glass, monochrome near-white — across every screen, on web and Tizen TV.

**Architecture:** Pure visual/interaction pass over existing components in `packages/ui` + `packages/features` and the token set in `packages/ui/src/theme.css`. No new routes, data shapes, or playback/request behavior. Every reference value comes from the design spec (measured from `abyss.css` / the live instance).

**Tech Stack:** React 19, Tailwind v4 (`@theme inline` tokens in `theme.css`), Base UI primitives, Norigin Spatial Navigation (TV via the injected `Action`/`TextInput` seam), lucide-react (icons), Vitest + @testing-library/react.

**Design spec:** `docs/superpowers/specs/2026-07-06-lolarr-ui-redesign-abyss-cinematic-design.md`
**Pixel targets (approved mockups):**
- Home/Shell: https://claude.ai/code/artifact/f1e0f5eb-2885-431d-9615-74b098d6294d
- Detail: https://claude.ai/code/artifact/17f2a95a-62ba-40f0-9101-f4b80f6de3fe
- Player+Dialog: https://claude.ai/code/artifact/542453fb-5fcf-4d38-9a1e-79081d78a1cc
- Ground truth: https://jellyfin.jladwig.de/web/#/home (remeasure via preview/computed-style; never assert a value)

## Global Constraints

- **No foreign class names** in code: no `.emby-*`, `.skinHeader`, `.raised`, `abyss.css:NNN`. Express every value in our own token vocabulary.
- **Monochrome near-white accent** `rgb(245 245 247)` (= `#f5f5f7`, token `--foreground`/`--primary`). Non-neutral color only for **status** (availability LED, toast severity via `--status-*`) and the **rating star** (amber `#e7c069`).
- **Control principle:** interactive chrome is **bare** — `background: transparent`, no border, own `backdrop-filter: blur(8px)`, hover/focus fill `rgb(255 255 255 / .10)`. The ONLY opaque surfaces: (1) primary CTA `rgb(255 255 255 / .95)` + `#121212` weight 600, (2) active nav tab / season chip `#f5f5f7` + `#121212` weight 600, (3) dialog panel dark frost.
- **TV parity:** every interactive element reachable via the Norigin D-pad through the injected `Action`/`TextInput` components. **No focusable buttons inside cards.** Media-remote keys drive playback (Slice 5).
- **Icons:** lucide-react. Animated states (favorite heart pop) via CSS keyframes on the lucide icon — no separate animated-icon dependency (see Task 1).
- **Verify by computed style, not assertion** (project rule): where a value matters, verify it live in the `web` preview (`preview_inspect`), do not merely claim it.
- **moon cache gap:** always build apps with `--force` (`moon run web:build --force`, `moon run tv:tizen-sync --force`); regenerated `apps/tv/tizen/assets/*` must be committed.
- Tests run with `pnpm --filter @lolarr/ui test` and `pnpm --filter @lolarr/features test` (vitest). Typecheck: `pnpm --filter @lolarr/ui exec tsc -p tsconfig.json`.

---

## File Structure

| File | Responsibility (after redesign) |
|---|---|
| `packages/ui/src/theme.css` | tokens: control-hover, dialog-frost, dialog-border, blur-controls=8px, primary-solid; `glass`/`glass-controls` utilities |
| `packages/ui/src/lib/icons.tsx` (new) | re-export the lucide icons used, one place |
| `packages/ui/src/components/ui/Button.tsx` | variant styles: `primary` solid, all others → bare; `card` unchanged |
| `packages/ui/src/components/ui/Input.tsx` | glass field, 44px |
| `packages/ui/src/components/ui/NavTabs.tsx` | bare tabs, no container, own blur, active solid, hover text-only |
| `packages/ui/src/components/AppFrame.tsx` | fixed bare nav, grid, search + person icons; content top-padding |
| `packages/ui/src/components/MediaPosterButton.tsx` | `orientation` prop (portrait/landscape), focus scale+ring, no in-card buttons |
| `packages/ui/src/components/EpisodeList.tsx` | reiverr grid of landscape episode cards |
| `packages/ui/src/components/StatusBadge.tsx` | bare LED-dot availability chip |
| `packages/ui/src/components/HeroPanel.tsx` | cinematic hero, bare chip, system buttons |
| `packages/ui/src/components/DetailPanel.tsx` | actions as focus targets, season chips, episode grid, similar rail |
| `packages/ui/src/components/ui/GlassDialog.tsx` | dark-frost panel values (keep TV recipe) |
| `packages/ui/src/components/SeasonRequestPicker.tsx` | selectable rows per system |
| `packages/ui/src/components/PlayerControls.tsx` | full control bar per reference, uniform 44px, remaining-negative time, gear, no PiP |
| `packages/ui/src/components/ToastStack.tsx` | token restyle |
| `packages/features/src/**` (Search/Requests/Detail/Login screens) | apply nav + card system |

---

## Pre-flight scope decisions (confirm before executing)

These are baked into the plan as defaults; flagged because the approved mockup shows more than the current player supports:

1. **Player subtitle / audio-track / settings buttons** appear in the mockup but require Jellyfin track-selection + a settings sheet that **do not exist yet**. Default: this redesign **defers** them (Task 12 restyles the real controls + adds prev/next, rating, "Endet um"). Adding them is a separate slice.
2. **Prev-episode** control: we have autoplay-**next** but no prev handler. Default: wire **next** (existing), render **prev** only if a `onPrev` handler is supplied, else omit.
3. **lucide-animated** package is not a verified dependency. Default: use `lucide-react` + a CSS `@keyframes` heart-pop. No extra dep.

---

## Task 1: Design tokens + lucide setup

**Files:**
- Modify: `packages/ui/src/theme.css:44-52` (glass/blur/status block) and `:15-54` (:root)
- Create: `packages/ui/src/lib/icons.tsx`
- Modify: `packages/ui/package.json` (add `lucide-react`)
- Test: `packages/ui/tests/tokens.test.tsx` (new)

**Interfaces:**
- Produces: CSS tokens `--control-hover`, `--dialog-frost`, `--dialog-border`, `--primary-solid`; `--blur-controls: 8px`; utility classes `glass` (dialog frost) and `glass-controls` (control blur). Icon re-exports from `@ui/lib/icons`.

- [ ] **Step 1: Add lucide-react**

```bash
pnpm --filter @lolarr/ui add lucide-react
```

- [ ] **Step 2: Create the icon module** `packages/ui/src/lib/icons.tsx`

```tsx
// Single source for the icons used across the UI (lucide-react).
export {
  Home, Search, Inbox, User, Play, Pause, Info, Plus, Heart, X, Check,
  ChevronRight, ArrowLeft, SkipBack, SkipForward, Rewind, FastForward,
  RotateCcw, RotateCw, Captions, Music, Volume2, Settings, Maximize, Star,
} from 'lucide-react'
```

- [ ] **Step 3: Add/adjust tokens in `theme.css`**

In `:root` add after `--surface-chip`:

```css
  --control-hover: rgb(255 255 255 / 0.1);
  --primary-solid: rgb(255 255 255 / 0.95);
  --dialog-frost: rgb(42 42 42 / 0.72);
  --dialog-border: rgb(245 245 247 / 0.16);
```

Change `--blur-controls: 4px;` → `--blur-controls: 8px;` and `--blur-overlay: 15px;` → `--blur-overlay: 20px;` (dialog frost blur). Change `--glass: rgb(42 42 42 / 0.6);` → `--glass: var(--dialog-frost);`.

In `@theme inline` add:

```css
  --color-control-hover: var(--control-hover);
  --color-primary-solid: var(--primary-solid);
  --color-dialog-frost: var(--dialog-frost);
  --color-dialog-border: var(--dialog-border);
```

- [ ] **Step 4: Write a token smoke test** `packages/ui/tests/tokens.test.tsx`

```tsx
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/theme.css', import.meta.url)), 'utf8')

describe('design tokens', () => {
  it('defines the control + dialog tokens', () => {
    expect(css).toContain('--control-hover: rgb(255 255 255 / 0.1)')
    expect(css).toContain('--primary-solid: rgb(255 255 255 / 0.95)')
    expect(css).toContain('--dialog-frost: rgb(42 42 42 / 0.72)')
    expect(css).toContain('--blur-controls: 8px')
  })
})
```

- [ ] **Step 5: Run tests** — `pnpm --filter @lolarr/ui test tokens` → PASS
- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/theme.css packages/ui/src/lib/icons.tsx packages/ui/package.json packages/ui/tests/tokens.test.tsx pnpm-lock.yaml
git commit -m "feat(ui): add control/dialog tokens and lucide icon module"
```

---

## Task 2: Button variants (bare controls + solid primary)

**Files:**
- Modify: `packages/ui/src/components/ui/Button.tsx`
- Test: `packages/ui/tests/Button.test.tsx`

**Interfaces:**
- Consumes: tokens from Task 1.
- Produces: `Button` keeps its existing variant union (`primary | secondary | ghost | glass | card`) and `size` (`md | lg`) — **no API break**. New styling: `primary` = solid near-white; `secondary`/`ghost`/`glass` all render the **bare** look; `card` unchanged. Backdrop-blur on bare variants.

- [ ] **Step 1: Update `Button.test.tsx`** — assert the new look

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from '@ui/components/ui/Button'

describe('Button', () => {
  it('primary is a solid near-white CTA', () => {
    render(<Button variant="primary">Go</Button>)
    const c = screen.getByRole('button').className
    expect(c).toContain('bg-primary-solid')
    expect(c).toContain('text-background')
  })
  it('bare variants have no border and carry their own blur', () => {
    render(<Button variant="secondary">Back</Button>)
    const c = screen.getByRole('button').className
    expect(c).toContain('bg-transparent')
    expect(c).toContain('backdrop-blur')
    expect(c).toContain('hover:bg-control-hover')
    expect(c).not.toContain('border-border')
  })
})
```

- [ ] **Step 2: Run** — `pnpm --filter @lolarr/ui test Button` → FAIL (old classes)

- [ ] **Step 3: Implement** — replace the `SIZES`/`VARIANTS` maps in `Button.tsx`

```tsx
const BASE =
  'group inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent text-sm font-medium whitespace-nowrap outline-none select-none transition-[transform,background-color,color] duration-[370ms] ease-out-expo focus-visible:ring-3 focus-visible:ring-ring/50 focused:scale-[1.04] focused:bg-control-hover disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-[18px]'
const SIZES = { md: 'h-11 px-4', lg: 'h-12 px-5' }
const BARE = 'bg-transparent text-foreground/90 backdrop-blur-[8px] hover:bg-control-hover hover:text-foreground'
const VARIANTS: Record<LolarrButtonVariant, string> = {
  primary: 'bg-primary-solid text-background font-semibold hover:bg-primary-solid',
  secondary: BARE,
  ghost: BARE,
  glass: BARE,
  card: 'flex flex-col items-start justify-start h-auto gap-2 p-0 bg-transparent text-left hover:bg-transparent',
}
```

(Keep the component body and `data-slot="button"` as-is.)

- [ ] **Step 4: Run** — `pnpm --filter @lolarr/ui test Button` → PASS
- [ ] **Step 5: Typecheck** — `pnpm --filter @lolarr/ui exec tsc -p tsconfig.json` → clean
- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/ui/Button.tsx packages/ui/tests/Button.test.tsx
git commit -m "feat(ui): bare button variants + solid primary CTA"
```

---

## Task 3: Input (glass field, 44px)

**Files:**
- Modify: `packages/ui/src/components/ui/Input.tsx`
- Test: `packages/ui/tests/Input.test.tsx` (new)

**Interfaces:** unchanged props (Base UI Input passthrough).

- [ ] **Step 1: Write test** `Input.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Input } from '@ui/components/ui/Input'

describe('Input', () => {
  it('is a 44px glass field', () => {
    render(<Input aria-label="q" />)
    const c = screen.getByLabelText('q').className
    expect(c).toContain('h-11')
    expect(c).toContain('backdrop-blur')
  })
})
```

- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** — className on the `BaseInput`:

```tsx
const INPUT =
  'h-11 w-full min-w-0 rounded-md border border-border/60 bg-surface px-3 py-1 text-base backdrop-blur-[8px] outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-surface-2 focused:border-ring focused:bg-surface-2 disabled:opacity-50'
```

- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/ui/Input.tsx packages/ui/tests/Input.test.tsx
git commit -m "feat(ui): glass input field at 44px"
```

---

## Task 4: NavTabs (bare tabs, no container)

**Files:**
- Modify: `packages/ui/src/components/ui/NavTabs.tsx`
- Test: `packages/ui/tests/NavTabs.test.tsx` (new)

**Interfaces:**
- Consumes: `Action` (DI seam), tokens.
- Produces: `NavTabs({ Action, items, ariaLabel })` where `items: { key, label, onPress, active?, badge? }[]`. Renders `<nav>` with NO container background; each item is an `Action variant="ghost"` (→ bare) at `h-9 rounded-[9px] px-4 backdrop-blur-[8px]`; active item = `bg-primary-solid text-background font-semibold`; inactive = `text-muted-foreground hover:text-foreground` (no bg on hover).

- [ ] **Step 1: Write test** — asserts no container bg, active class, badge

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NavTabs } from '@ui/components/ui/NavTabs'
import { DefaultAction } from '@ui/components/DefaultAction'

const items = [
  { key: 'home', label: 'Start', onPress: () => {}, active: true },
  { key: 'req', label: 'Anfragen', onPress: () => {}, badge: 3 },
]

describe('NavTabs', () => {
  it('renders bare tabs with a solid active tab and a badge', () => {
    render(<NavTabs Action={DefaultAction} items={items} ariaLabel="Hauptnavigation" />)
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' })
    expect(nav.className).not.toContain('bg-')      // no container fill
    const active = screen.getByText('Start').closest('button')!
    expect(active.className).toContain('bg-primary-solid')
    expect(screen.getByText('3')).toBeInTheDocument() // badge
  })
})
```

- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** — `<nav aria-label={ariaLabel} className="inline-flex items-center gap-1">`, each item:

```tsx
<Action
  key={item.key}
  variant="ghost"
  onPress={item.onPress}
  focusKey={`nav-${item.key}`}
  className={cn(
    'h-9 rounded-[9px] px-4 text-sm font-medium backdrop-blur-[8px]',
    item.active
      ? 'bg-primary-solid text-background font-semibold'
      : 'text-muted-foreground hover:bg-transparent hover:text-foreground',
  )}
>
  {item.label}
  {item.badge ? <span className="nav-badge ml-1.5 grid h-[19px] min-w-[19px] place-items-center rounded-[7px] bg-surface-chip px-1.5 text-[11px] font-semibold">{item.badge}</span> : null}
</Action>
```

- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/ui/NavTabs.tsx packages/ui/tests/NavTabs.test.tsx
git commit -m "feat(ui): bare navtabs without container, solid active tab"
```

---

## Task 5: AppFrame (fixed bare nav + icons + propagation)

**Files:**
- Modify: `packages/ui/src/components/AppFrame.tsx`
- Modify: features screens that render `AppFrame` without nav items (Search/Requests/Detail) — pass `navItems`
- Test: `packages/ui/tests/AppFrame.test.tsx` (new)

**Interfaces:**
- Consumes: `NavTabs`, `Action`, icons.
- Produces: `<AppFrame>` renders a **fixed** `<header>` (`fixed top-0 inset-x-0 z-50`, no background) with `grid-cols-[1fr_auto_1fr]`: left wordmark, center `NavTabs`, right tools (search icon `Action` + person icon `Action`, both bare). Main content gets top padding to clear the fixed header.

- [ ] **Step 1: Write test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppFrame } from '@ui/components/AppFrame'
import { DefaultAction } from '@ui/components/DefaultAction'

describe('AppFrame', () => {
  it('has a fixed, background-less header with search + profile icons', () => {
    render(<AppFrame Action={DefaultAction}><div>content</div></AppFrame>)
    const header = screen.getByRole('banner')
    expect(header.className).toContain('fixed')
    expect(header.className).not.toContain('bg-')
    expect(screen.getByLabelText('Suche')).toBeInTheDocument()
    expect(screen.getByLabelText('Profil')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** — header:

```tsx
<header className="fixed top-0 inset-x-0 z-50 grid grid-cols-[1fr_auto_1fr] items-center px-10 py-[18px]">
  <span className="flex items-center gap-2.5 font-semibold tracking-[0.18em]">LOLARR</span>
  {navItems ? <NavTabs Action={Action} items={navItems} ariaLabel="Hauptnavigation" className="justify-self-center" /> : <span />}
  <div className="justify-self-end flex items-center gap-2">
    <Action variant="ghost" ariaLabel="Suche" focusKey="nav-search" className="h-[41px] w-[41px] p-0 backdrop-blur-[8px]"><Search className="size-5" /></Action>
    <Action variant="ghost" ariaLabel="Profil" focusKey="nav-profile" className="h-[41px] w-[41px] p-0 backdrop-blur-[8px]"><User className="size-5" /></Action>
  </div>
</header>
<main className="pt-24">{children}</main>
```

(Import `Search, User` from `@ui/lib/icons`. Preserve existing `onConfigureGateway` handling by routing it into the profile menu or leaving the existing affordance.)

- [ ] **Step 4: Propagate nav** — in `RequestsScreen`, `SearchScreen`, `DetailScreen` (features), pass `navItems={[{key:'home',...},{key:'requests',...}]}` with the active one set. (Grep `packages/features` for `<AppFrame`.)
- [ ] **Step 5: Run** — `pnpm --filter @lolarr/ui test AppFrame` and `pnpm --filter @lolarr/features test` → PASS
- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/AppFrame.tsx packages/features/src
git commit -m "feat(ui): fixed bare app header with icon tools, propagate nav to all screens"
```

---

## Task 6: MediaPosterButton (orientation + focus)

**Files:**
- Modify: `packages/ui/src/components/MediaPosterButton.tsx`
- Test: `packages/ui/tests/MediaPosterButton.test.tsx` (new)

**Interfaces:**
- Produces: adds `orientation?: 'portrait' | 'landscape'` (default `portrait`). Poster aspect `2/3` or `16/9`; radius `rounded-md`; edge `ring-1 ring-inset ring-white/[0.06] shadow-[inset_0_0_3px_rgb(200_200_200/0.35)]`; hover/focus `scale-[1.06]` + `ring-2 ring-white/30`. **No buttons inside.** Whole card is the `Action`.

- [ ] **Step 1: Write test** — landscape orientation + no nested button

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MediaPosterButton } from '@ui/components/MediaPosterButton'
import { DefaultAction } from '@ui/components/DefaultAction'

const item = { id: '1', title: 'X', posterUrl: 'p.jpg', backdropUrl: 'b.jpg', mediaType: 'movie', availability: 'available' } as any

describe('MediaPosterButton', () => {
  it('supports landscape and has no nested buttons', () => {
    const { container } = render(<MediaPosterButton item={item} orientation="landscape" onPress={() => {}} Action={DefaultAction} />)
    expect(container.querySelector('.aspect-video')).toBeTruthy()
    expect(container.querySelectorAll('button').length).toBe(1) // the card itself only
  })
})
```

- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** — orientation-driven aspect class + progress bar for landscape; keep the availability overlay chip as a non-interactive `<span>` (not a button). Use `orientation === 'landscape' ? 'aspect-video' : 'aspect-[2/3]'`.
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Preview-verify** — start `web`, open Home, `preview_inspect` a poster: confirm `border-radius: 12px` and the focus ring on `:focus`.
- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/MediaPosterButton.tsx packages/ui/tests/MediaPosterButton.test.tsx
git commit -m "feat(ui): media card orientation + focus scale/ring, no in-card buttons"
```

---

## Task 7: EpisodeList (reiverr grid)

**Files:**
- Modify: `packages/ui/src/components/EpisodeList.tsx`
- Test: `packages/ui/tests/EpisodeList.test.tsx`

**Interfaces:** unchanged props; layout becomes a responsive **grid** of landscape episode cards (thumbnail + progress, then title · `Folge N` · runtime). Whole row/card focusable via `Action`; Select plays the episode; **no play button inside**.

- [ ] **Step 1: Update test** — assert grid container + one focusable per episode + no per-episode play button

```tsx
// container has grid-cols; each episode renders exactly one Action (button); caption shows "Folge N"
expect(container.querySelector('[class*="grid-cols"]')).toBeTruthy()
```

- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** — wrapper `className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-x-5 gap-y-6"`; each episode = `Action variant="card"` with a `aspect-video rounded-md` thumbnail (+ progress bar) and a caption row `title` / `Folge N` (faint) / `runtime` (faint, right).
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/EpisodeList.tsx packages/ui/tests/EpisodeList.test.tsx
git commit -m "feat(ui): episode grid of landscape cards (reiverr layout)"
```

---

## Task 8: StatusBadge / availability chip (bare LED dot)

**Files:**
- Modify: `packages/ui/src/components/StatusBadge.tsx`
- Test: `packages/ui/tests/StatusBadge.test.tsx`

**Interfaces:** unchanged props (`availability`). Renders a bare inline-flex: colored **LED dot** (status color) + label + `backdrop-blur-[8px]`, **no fill, no border**.

- [ ] **Step 1: Update test** — assert dot color class + no border/bg fill

```tsx
const c = screen.getByText(/verfügbar/i).closest('span')!.className
expect(c).toContain('backdrop-blur')
expect(c).not.toContain('border')
```

- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** — `<span className="inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs backdrop-blur-[8px]"><span className={cn('size-[7px] rounded-full', dotClassForAvailability(a))} />{label}</span>`. Map availability → `bg-status-available` / amber / neutral.
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/StatusBadge.tsx packages/ui/tests/StatusBadge.test.tsx
git commit -m "feat(ui): bare availability chip with status LED dot"
```

---

## Task 9: HeroPanel (cinematic hero)

**Files:**
- Modify: `packages/ui/src/components/HeroPanel.tsx`
- Test: `packages/ui/tests/HeroPanel.test.tsx` (new)

**Interfaces:** unchanged props. Full-bleed backdrop + left/bottom scrim; content bottom-left: availability chip (Task 8), title, meta row, `Play` (primary) + `Mehr Infos` (bare) buttons via `Action`.

- [ ] **Step 1: Write test** — Play is primary, Mehr Infos is bare, chip present
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** — keep the existing `HERO_SHELL` full-bleed frame; primary `Action variant="primary"`, secondary `Action variant="ghost"`; render `<StatusBadge>` chip.
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Preview-verify** — Home hero: Play button computed `background-color` ≈ `rgba(255,255,255,0.95)`.
- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/HeroPanel.tsx packages/ui/tests/HeroPanel.test.tsx
git commit -m "feat(ui): cinematic hero with primary/bare actions and status chip"
```

---

## Task 10: DetailPanel (actions, season chips, episode grid)

**Files:**
- Modify: `packages/ui/src/components/DetailPanel.tsx`, `packages/ui/src/components/SeasonSelector.tsx`
- Test: `packages/ui/tests/DetailPanel.test.tsx` (new)

**Interfaces:** unchanged props. Backdrop hero + rating + availability chip; action row = primary (`Fortsetzen/Abspielen`) + bare (`Weitere Staffeln anfragen`, `Merken`). Season chips follow the tab rule (active solid, else text-hover; requested marked). Episodes via `EpisodeList` grid (Task 7). Similar rail via `MediaRail` (portrait).

- [ ] **Step 1: Write test** — request action is bare, primary action present, season chip active class
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** — action buttons per system; `SeasonSelector` chips `h-9 rounded-[9px] px-4`, active `bg-primary-solid text-background font-semibold`, else `text-muted-foreground hover:text-foreground`.
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/DetailPanel.tsx packages/ui/src/components/SeasonSelector.tsx packages/ui/tests/DetailPanel.test.tsx
git commit -m "feat(ui): detail actions as focus targets, tab-rule season chips, episode grid"
```

---

## Task 11: GlassDialog + SeasonRequestPicker (dark frost)

**Files:**
- Modify: `packages/ui/src/components/ui/GlassDialog.tsx`, `packages/ui/src/components/SeasonRequestPicker.tsx`
- Test: `packages/ui/tests/GlassDialog.test.tsx` (update)

**Interfaces:** `GlassDialog` unchanged props + TV recipe (`modal={false}`, `initialFocus={false}`, `OverlayScope`). Popup panel = dark frost.

- [ ] **Step 1: Update test** — popup has dialog-frost class + 24px radius + border-dialog
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** — Popup className: `'fixed top-1/2 left-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-dialog-border bg-dialog-frost p-5 backdrop-blur-[20px] text-popover-foreground outline-none'` (replace the `glass` utility use). SeasonRequestPicker rows: selectable `Action` rows with a 20px checkbox `.box`, whole row focusable; available/requested seasons disabled; footer primary + bare.
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/ui/GlassDialog.tsx packages/ui/src/components/SeasonRequestPicker.tsx packages/ui/tests/GlassDialog.test.tsx
git commit -m "feat(ui): dark-frost dialog panel + selectable season rows"
```

---

## Task 12: PlayerControls (Jellyfin-reference bar)

**Files:**
- Modify: `packages/ui/src/components/PlayerControls.tsx`
- Test: `packages/ui/tests/playerControls.test.tsx`

**Interfaces:**
- Props add (optional): `rating?: number`, `onNext?: () => void`, `onPrev?: () => void`. Existing props unchanged.
- Layout: scrubber row = elapsed (left) · `<input range>` styled track · **remaining negative** (right, `-mm:ss`), all `tabular-nums`. Control row: left cluster `prev?(onPrev) · rewind(onSeekBy -10) · play/pause · forward(onSeekBy +10) · next?(onNext) · | · ★rating? · "Endet um HH:MM"`; right cluster `favorite · volume(+slider web) · fullscreen`. **All buttons uniform 44px** `Action` with lucide icons (no enlarged play). Deferred per pre-flight #1: no subtitle/audio/settings buttons. Gear icon reserved for a future settings sheet (omit for now).

- [ ] **Step 1: Update test** — assert remaining-negative time, uniform buttons, no PiP, aria-labels

```tsx
// remaining shows a leading minus; play/pause and seek buttons share the same size class
expect(screen.getByText(/^-/)).toBeInTheDocument()
expect(screen.getByLabelText('Fullscreen')).toBeInTheDocument()
```

- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** — replace glyph children with lucide icons inside `Action`; add `endsAt(position, duration)` (pure, from a passed `now` epoch — inject via prop `now?: number` defaulting to `Date.now()` at call site to keep the component pure/testable); render `-${formatTime(duration - position)}` for remaining. Uniform button size class (e.g. `h-11 w-11 p-0`).
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Preview-verify** — open a player route; confirm buttons equal size and remaining time negative.
- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/PlayerControls.tsx packages/ui/tests/playerControls.test.tsx
git commit -m "feat(ui): player control bar per jellyfin reference (uniform, remaining time, lucide)"
```

---

## Task 13: ToastStack (token restyle)

**Files:**
- Modify: `packages/ui/src/components/ToastStack.tsx`
- Test: `packages/ui/tests/ToastStack.test.tsx`

**Interfaces:** unchanged. Glass surface + left status stripe via `border-l-status-*` (already the pattern). Ensure blur + token colors, no hardcoded rgba.

- [ ] **Step 1: Confirm/adjust test** — the existing test already asserts `.border-l-status-available` / `.border-l-status-failed`; keep it green, tighten if needed.
- [ ] **Step 2: Implement** — apply `glass` utility + `backdrop-blur`, token status stripe.
- [ ] **Step 3: Run** → PASS
- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/ToastStack.tsx packages/ui/tests/ToastStack.test.tsx
git commit -m "feat(ui): token-restyled toasts"
```

---

## Task 14: Search + Requests + Login screens (apply system)

**Files:**
- Modify: `packages/ui/src/components/SearchBar.tsx`, `RequestList.tsx`, `RequestStatusBadge.tsx`, `LoginPanel.tsx`, `QuickConnectPanel.tsx`, `GatewayPanel.tsx`, `ErrorPanel.tsx`
- Modify: features Search/Requests/Login screens (nav propagation done in Task 5; here it's the inner content)
- Test: update the relevant existing tests (`RequestStatusBadge.test.tsx`, etc.)

**Interfaces:** apply the control system — bare buttons, glass inputs, portrait card grid for search results, status rows for requests. `RequestStatusBadge` mirrors the bare LED-dot chip (Task 8) with request-status colors.

- [ ] **Step 1: Update tests** — RequestStatusBadge bare chip; search results use `MediaPosterButton`
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** — restyle each panel; SearchBar uses `Input` (Task 3); results grid uses `MediaPosterButton` portrait; RequestList rows use the bare status chip + bare cancel.
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components packages/features/src
git commit -m "feat(ui): apply the system to search, requests, and auth screens"
```

---

## Task 15: Full verification + docs + TV assets

**Files:**
- Modify: `packages/ui/src/components/PillTabs.tsx` (remove if now unused — grep first) and any dead code
- Modify: regenerated `apps/tv/tizen/assets/*`
- Modify: `packages/ui/README.md` or the design section docs

- [ ] **Step 1: Remove dead code** — grep `PillTabs` usage; if unused, delete `PillTabs.tsx` + `PillTabs.test.tsx`.
- [ ] **Step 2: Typecheck all** — `pnpm -r exec tsc -p tsconfig.json` (or the repo's typecheck task) → clean
- [ ] **Step 3: Unit tests** — `pnpm --filter @lolarr/ui test` + `pnpm --filter @lolarr/features test` → all green
- [ ] **Step 4: Production build (authoritative)** — `moon run web:build --force` → clean
- [ ] **Step 5: TV build** — `moon run tv:tizen-sync --force`; commit regenerated `apps/tv/tizen/assets/*`
- [ ] **Step 6: Preview computed-style spot checks** — start `web`; verify against the mockups: nav has no background, active tab `#f5f5f7`+`#121212`, a bare button has `background: transparent` + `backdrop-filter: blur(8px)`, dialog panel `rgb(42 42 42 / 0.72)`, player buttons equal size. Fix any divergence, re-run the covering test.
- [ ] **Step 7: Docs** — update the UI docs to describe the bare-control system + token table.
- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore(ui): verify redesign, remove dead code, regenerate tizen assets, docs"
```

---

## Final review

After all tasks: dispatch the whole-branch review (superpowers:requesting-code-review) over the range, then superpowers:finishing-a-development-branch. TV on-device visual approval (S94C) remains a manual gate the user performs.
