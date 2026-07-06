# Lolarr UI-Redesign — Abyss-Cinematic Visual System

> **For agentic workers:** This is a **design spec**. It supersedes the *visual layer* of
> `2026-07-05-lolarr-ui-foundation-design.md` (the architecture there — Base-UI wrappers, DI
> Action/TextInput seam, OverlayScope, tokens in `theme.css` — still holds). Turn this into an
> implementation plan with superpowers:writing-plans, then execute with
> superpowers:subagent-driven-development.

**Goal:** Restyle the existing Slice-7 UI so it faithfully matches the **abyss-jellyfin** theme
(measured live, not guessed) in **reiverr's** layout — cinematic, glass, monochrome near-white —
across every screen and on both web and Tizen TV.

**Architecture:** No new features, routes, or data. This is a visual/interaction pass over the
existing components in `packages/ui` and `packages/features`, plus the token set in
`packages/ui/src/theme.css`. Every reference value below was read from the user's live abyss
instance via `getComputedStyle`, or from `abyss.css` / the reiverr source directly.

**Tech Stack:** React 19, Tailwind v4 (`@theme inline` tokens), Base UI primitives, Norigin
Spatial Navigation (TV), lucide-react + lucide-animated (icons).

## Visual references

Approved mockups (the pixel target for implementation):

- **Home / Shell:** https://claude.ai/code/artifact/f1e0f5eb-2885-431d-9615-74b098d6294d
- **Detail:** https://claude.ai/code/artifact/17f2a95a-62ba-40f0-9101-f4b80f6de3fe
- **Player + Dialog:** https://claude.ai/code/artifact/542453fb-5fcf-4d38-9a1e-79081d78a1cc
- **Ground truth (live abyss):** https://jellyfin.jladwig.de/web/#/home — remeasure here if any value is unclear; never assert a value without checking it.

## Global Constraints

- **No foreign class names** in code: no `.emby-*`, `.skinHeader`, `.raised`, `abyss.css:NNN`
  references. Every reference value is expressed in **our own token vocabulary**.
- **Monochrome near-white accent** `rgb(245 245 247)`. The only non-neutral colors are **status**
  (availability LED, toast severity via existing status tokens) and the **rating star** (amber).
- **Icons: lucide-react**, with **lucide-animated** for stateful ones (e.g. favorite heart pop).
- **TV parity:** every interactive element is reachable and operable with the Norigin D-pad. No
  nested focusable buttons inside cards. Media-remote keys drive playback (Slice 5).
- **Reduced motion:** all transforms/animations respect `prefers-reduced-motion`.

## Design Tokens (measured)

| Token | Value | Notes |
|---|---|---|
| accent | `rgb(245 245 247)` | near-white; active/primary fills, focus rings, scrubber fill |
| on-accent | `#121212` | text on accent; weight 600–700 |
| muted text | `rgb(245 245 247 / .60)` | inactive labels, meta |
| faint text | `rgb(245 245 247 / .40)` | captions, ticks |
| control hover-fill | `rgb(245 245 247 / .10)` | the only fill bare controls get, on hover/focus |
| control blur | `blur(8px)` backdrop | every bare control carries its own blur |
| primary fill | `rgb(255 255 255 / .95)` | solid CTA (Play/Fortsetzen); text `#121212` weight 600 |
| dialog frost | `rgb(42 42 42 / .72)` + `blur(20px)` | dialogs/overlays only (needs legibility over content) |
| dialog border | `1px solid rgb(245 245 247 / .16)` | |
| card inset | `inset 0 0 3px rgb(200 200 200 / .35)` | poster/thumbnail edge |
| focus ring | `2px solid rgb(245 245 247)`, offset 2–3px | cards, rows, controls |
| radius / content | `12px` | buttons, cards, controls, chips-with-fill |
| radius / dialog | `24px` | dialog panel |
| radius / small | `9px` | nav tab item, season chip |
| ease | `cubic-bezier(.16, 1, .3, 1)` | |
| duration | `.37s` (micro `.3s`) | matches abyss |
| rating star | `#e7c069` (amber) | status-only exception |
| availability LED | green available · amber partial · neutral requested/processing | dot only |

Add any missing values to `theme.css` (`@theme inline`), e.g. `--control-hover`, `--dialog-frost`,
`--dialog-border`. Do **not** hardcode raw rgba in components — reference tokens.

## Component System

### Control principle (the core rule)
Interactive chrome — nav tabs, icon buttons, secondary/text action buttons, player controls,
dialog cancel/close — are **bare**: `background: transparent`, **no border**, their **own**
`backdrop-filter: blur(8px)`, and a **subtle hover/focus fill** `rgb(245 245 247 / .10)`. They carry
no visible chip/fill at rest. Icons/text are near-white (`.85–.90`).

The **only** exceptions with a solid/opaque surface:
1. **Primary CTA** (Play, Fortsetzen, Anfragen-confirm): solid `rgb(255 255 255 / .95)` + `#121212`, weight 600.
2. **Active nav tab / active season chip:** solid `rgb(245 245 247)` + `#121212`, weight 600.
3. **Dialog panel:** dark frost (see Dialog).

Rationale: mirrors abyss' spotlight buttons (light frost secondary, near-solid primary) and keeps
one clear CTA per view. This was iterated to convergence with the user.

### Navigation (fixed, bare)
- **Position: fixed** at top, full width, `z-50`, padding `18px 40px`. Does **not** scroll away.
  **No navbar background** — the tabs/controls carry their own blur; do not add a scrolled-state bar.
- Layout `grid-cols-[1fr_auto_1fr]`: left wordmark `LOLARR`, center tab group, right tools.
- **Tabs**: no container. Each tab `h-9` (`38px`), `px-4`, radius `9px`, own `blur(8px)`.
  - Inactive: `muted` text; **hover only brightens text** (no fill) — confirmed from abyss
    `.emby-tab-button:hover` which sets only `color`.
  - Active: solid `rgb(245 245 247)` + `#121212`, weight 600.
  - Badge (e.g. Anfragen count): small pill, subtle.
- **Icons** (right): bare, transparent, `~41px`, lucide (search); hover-fill only. **Profile** is a
  bare **person icon** — not an avatar image/initials/chip.
- Screens Home/Search/Requests/Detail all render this same nav (Detail included).

### Cards (portrait + landscape)
- Two orientations: **portrait** poster `aspect-2/3` (default, larger — media is the focus) and
  **landscape** `aspect-16/9` (continue-watching, episodes). Radius `12px`, inset edge shadow.
- **Whole card is one focus target. No buttons inside cards** (TV D-pad rule, verified against
  Netflix/Disney+/Prime/Apple TV/Jellyfin-TV). Focus = `scale(1.05–1.06)` + near-white ring.
- Optional focus/long-hover expand: portrait → landscape info-preview (title/meta/progress), **still
  no buttons**. Continue-watching cards show a near-white progress bar.
- **Select opens the detail page** for all cards (consistent). Resume happens from detail or the
  remote Play key — never a card-level Play button.

### Availability chip
Bare: colored **LED dot** + text + `blur(8px)`, **no fill, no border**. States: available (green),
partial (amber), requested/processing (neutral). Used on Hero and Detail.

### Dialog (dark frost)
- Overlay via existing `GlassDialog` (Base UI Dialog, TV recipe preserved: `modal={false}` +
  `initialFocus={false}` + `OverlayScope`).
- Scrim dims background (`rgb(0 0 0 / .55–.60)`).
- **Panel: dark frost** `rgb(42 42 42 / .72)` + `blur(20px)` + border `rgb(245 245 247 / .16)` +
  radius `24px` + drop shadow. This is the one place glass has a *surface* (must stay legible over
  arbitrary content).
- Title + bare close (X). Selectable rows (see Season picker). Footer: primary + bare cancel.

### Player controls (per Jellyfin reference)
Bottom control bar over a gradient scrim; **all buttons uniform `44px`, bare** (own blur, hover-fill),
lucide icons. Play/Pause is **not** enlarged.
- **Scrubber row:** elapsed time (left), track with near-white fill + thumb + chapter ticks,
  **remaining time negative** (right). All times `tabular-nums`.
- **Left cluster:** previous · rewind (−10s) · fast-rewind · play/pause · fast-forward · forward
  (+10s) · next · divider · **★ rating** (amber) · "Endet um HH:MM".
- **Right cluster:** favorite (heart, lucide-animated) · subtitles · audio track · **volume + slider**
  · settings (**gear**, not a sun) · fullscreen. **No Picture-in-Picture** (unsupported).
- **TV:** volume-slider drops; D-pad focus; remote media keys drive play/pause/skip (Slice 5).

### Toasts
Restyle existing `ToastStack` to the token vocabulary: glass surface, left status stripe via
existing status tokens (available/processing/declined/failed/requested). No layout change.

## Screens

### Home
Fixed bare nav · **cinematic full-bleed hero** (backdrop + left/bottom scrim, title, meta,
availability chip, **Play** = solid primary + **Mehr Infos** = bare) · below: horizontal **rails** —
"Weiterschauen" (landscape + progress), "Trending"/discover (portrait, larger). One card focused
shows the scale+ring.

### Detail
Fixed bare nav · **backdrop hero** with title/meta/rating + availability chip + overview · **actions
are the focus targets here** (this is where card-Select lands): **Fortsetzen/Abspielen** (primary),
**Weitere Staffeln anfragen** (bare, appears per availability), **Merken** (bare, animated heart) ·
**Season chips** (tab rule: active solid, else text-hover; requested seasons marked) · **Episode
grid** (reiverr-style landscape cards: thumbnail + progress, title · "Folge N" · runtime; whole card
focusable, Select plays) · **Ähnlich** portrait rail.

### Search
Fixed bare nav · **glass search input** (token field style) reachable from the nav search icon ·
results as a **portrait card grid** using the same card. Empty/loading states use Skeleton.

### Requests
Fixed bare nav · list of request items as **status rows/cards**: poster thumb + title + **status
chip** (requested/processing/available/declined/failed) · cancel action is bare. Season-level
requests open the Season-picker dialog.

### Player
Full-screen video + the control bar above. Up-next/autoplay-next affordance reuses the dialog/card
vocabulary.

### Season picker (dialog)
Dark-frost dialog · "Alle Staffeln" toggle + one selectable **row per season** (checkbox 12px,
whole row focusable + ring); available/requested seasons disabled · footer **Anfragen** (primary) +
**Abbrechen** (bare). TV keeps focus inside (OverlayScope).

### Auth / Login
Apply the same system: bare controls, token field inputs, one primary CTA (Quick Connect / Sign in),
glass where a surface is needed.

## TV behavior (summary)
- Whole card = one focus target; no in-card buttons; Select → detail; resume via detail/Play key.
- Norigin D-pad everywhere; dialogs trap focus via OverlayScope (validated recipe).
- Player: uniform focusable controls; remote media keys parallel; volume-slider/PiP absent.
- Focus visual = scale + near-white ring; respects reduced-motion.

## Affected components (existing → change)

| File | Change |
|---|---|
| `packages/ui/src/theme.css` | add control-hover / dialog-frost / dialog-border tokens; confirm accent, radii, ease |
| `packages/ui/src/components/AppFrame.tsx` | fixed bare nav, grid, right tools = search icon + person icon |
| `packages/ui/src/components/ui/NavTabs.tsx` | bare tabs (no container), own blur, active solid, hover text-only |
| `packages/ui/src/components/ui/Button.tsx` | variants: `primary` (solid near-white), `bare` (transparent+blur+hover-fill) replaces `glass`/`secondary`/`ghost` chip look; keep `card` |
| `packages/ui/src/components/ui/Input.tsx` | token field (glass field), 44px |
| `packages/ui/src/components/ui/GlassDialog.tsx` | dark-frost panel values; keep TV recipe |
| `packages/ui/src/components/HeroPanel.tsx` | cinematic hero, availability chip bare, buttons per system |
| `packages/ui/src/components/MediaPosterButton.tsx` | portrait+landscape, focus scale+ring, no in-card buttons |
| `packages/ui/src/components/PlayerControls.tsx` | full control bar per reference, uniform 44px, scrubber times both ends, gear, no PiP |
| `packages/ui/src/components/DetailPanel.tsx` | actions as focus targets, season chips, episode grid, similar rail |
| `packages/ui/src/components/SeasonRequestPicker.tsx` | dialog rows per system |
| `packages/ui/src/components/ToastStack.tsx` | token restyle |
| `packages/ui/src/components/StatusBadge.tsx` + availability chip | bare LED-dot chip |
| features screens (Search/Requests/Detail/Login) | apply nav + card system |

## Out of scope
- New features, routes, or data shapes.
- Picture-in-Picture, chapter data, ratings source (rating shown if already available; else omit).
- Font change (keep current app font; ensure weights 400/500/600).
- Non-visual behavior of playback/requests (unchanged).
