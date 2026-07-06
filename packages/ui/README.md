# @lolarr/ui

Shared component library for Lolarr's web (`apps/web`) and TV (`apps/tv`, Tizen/Norigin) frontends.
Components are injected with an `ActionComponent`/`TextInputComponent` seam (`DefaultAction` on
web, `TvAction`/Norigin on TV) so the same JSX drives both a pointer UI and a D-pad UI. Styling is
Tailwind v4 with tokens defined in `src/theme.css` (`@theme inline`), consumed as utility classes —
never raw hex/rgba in component code.

This document describes the **visual system** introduced by the UI redesign (abyss-jellyfin
inspired, monochrome, dark-only). The full design spec with measured reference values lives at
`docs/superpowers/specs/2026-07-06-lolarr-ui-redesign-abyss-cinematic-design.md`.

## The bare-control system

The core rule for interactive chrome (nav tabs, icon buttons, secondary/text buttons, player
controls, dialog cancel/close): controls are **bare** by default —

- `background: transparent`
- **no border**
- their **own** `backdrop-filter: blur(8px)` (`backdrop-blur-[8px]` / the `glass-controls` utility)
- a **subtle hover/focus fill only**, `var(--control-hover)` (`hover:bg-control-hover`)

They carry no visible chip/fill at rest — the surface only appears on interaction. This mirrors
abyss/reiverr's spotlight-button pattern: light-frost secondary actions, a near-solid primary, and
nothing decorative in between.

There are exactly three surfaces that break the bare rule with an opaque/solid fill:

1. **Primary CTA** — Play, Fortsetzen, Anfragen-confirm: solid `var(--primary-solid)`
   (`rgb(255 255 255 / .95)`) with `#121212` text, weight 600. One per view.
2. **Active nav tab / active season chip** — solid `var(--foreground)` (`rgb(245 245 247)`) with
   `#121212` text, weight 600. Also keeps that solid fill on hover (`hover:bg-primary-solid` on the
   active branch) — it must not fall back to the bare hover treatment.
3. **Dialog panel** — dark frost, the one place glass has a real background (see below); needs to
   stay legible over arbitrary content behind it.

Everything else — inactive nav tabs, inactive season chips, player buttons, icon buttons — is bare
at rest. Inactive tabs/chips brighten text on hover/focus but must **not** pick up a fill
(`hover:bg-transparent`), matching abyss' `.emby-tab-button:hover` behavior of only changing color.

Cards are a separate rule: the whole card is one focus target (no buttons nested inside, for D-pad
sanity), with a `scale(1.05–1.06)` + near-white ring on focus/hover instead of a fill change.

## Token table

Defined in `packages/ui/src/theme.css` under `:root` and re-exposed as Tailwind colors under
`@theme inline`. Use the Tailwind utility, not the raw CSS variable, in component code.

| Token (CSS var) | Value | Tailwind utility | Notes |
|---|---|---|---|
| `--foreground` / accent | `#f5f5f7` (`rgb(245 245 247)`) | `text-foreground` | near-white; the only accent color; active fills, focus rings, scrubber fill |
| `--background` | `#0a0a0c` | `bg-background` | page background |
| `--muted-foreground` | `#a1a1a6` | `text-muted-foreground` | inactive labels, meta, secondary text |
| `--control-hover` | `rgb(255 255 255 / 0.1)` | `hover:bg-control-hover` | the *only* fill a bare control gets, on hover/focus |
| `--blur-controls` | `8px` | `backdrop-blur-[8px]` | every bare control's own blur |
| `--primary-solid` | `rgb(255 255 255 / 0.95)` | `bg-primary-solid` | solid CTA / active tab-chip fill; paired with `text-background` |
| `--dialog-frost` (`--glass`) | `rgb(42 42 42 / 0.72)` | `bg-dialog-frost` / `glass` utility | dialog panel surface only |
| `--dialog-border` | `rgb(245 245 247 / 0.16)` | `border-dialog-border` | dialog panel border |
| `--blur-overlay` | `20px` | `glass` utility | dialog panel blur |
| `--surface` / `-2` / `-3` | `rgb(255 255 255 / .04 / .07 / .11)` | `bg-surface[-2/-3]` | card/row background steps |
| `--surface-chip` | `rgb(40 40 40 / 0.8)` | `bg-surface-chip` | solid dark chip (e.g. nav badge) that inverts on hover |
| `--status-available` | `#6fbf9f` (green) | `text-status-available` | availability LED, "watched" check |
| `--status-processing` | `#8fa8c9` (blue) | `text-status-processing` | processing LED / toast stripe |
| `--status-pending` | `#c9b37e` (amber) | `text-status-pending` | pending LED / rating star color |
| `--status-declined` / `--status-failed` | `#c98181` (red) | `text-status-declined` | error/declined LED / toast stripe |
| `--status-requested` | `#a393c9` (purple) | `text-status-requested` | requested-marker dot on season chips |
| `--danger` | `#d97b7b` | `text-danger` | destructive actions |
| `--radius-sm` | `8px` | `rounded-sm` | small elements |
| `--radius-md` (`--radius`) | `12px` | `rounded-md` | buttons, cards, controls, chips-with-fill |
| `--radius-lg` | `24px` | `rounded-lg` | dialog panel |
| nav tab / season chip radius | `9px` | `rounded-[9px]` | not tokenized — smaller than `--radius-sm`, matches abyss exactly |
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | `ease-out-expo` | primary motion easing (transitions, favorite pop) |
| `--ease-snappy` | `cubic-bezier(0.4, 0, 0.2, 1)` | `ease-snappy` | snappier secondary easing |

Status colors are the **only** non-neutral colors in the system (plus the amber rating star, which
reuses `--status-pending`). Everything else is monochrome near-white/black — do not introduce new
hues without a status meaning.

**No foreign class names**: nothing in `packages/ui` or the apps references `.emby-*`,
`.skinHeader`, `.raised`, or other abyss/Jellyfin-web class names — every value above was measured
from the live reference and re-expressed in this package's own token vocabulary.

## Deferred functionality

The redesign intentionally shipped some controls and layout slots that **render** correctly but
are **not wired to real behavior** yet. Each is marked in code so it's easy to grep for
(`TODO(player)` in `PlayerControls.tsx`). Listed here so it's not mistaken for an oversight:

### Player controls (`packages/ui/src/components/PlayerControls.tsx`)

| Control | Current behavior | What it needs |
|---|---|---|
| **Previous** | Calls `onPrev` if provided, otherwise a no-op | A previous-episode navigation handler from the playback feature/screen (episode list + index lookup), passed down as `onPrev` |
| **Next** | Calls `onNext` if provided, otherwise a no-op | Same as Previous — a next-episode navigation handler wired from the season/episode data already available on the detail screen |
| **Subtitles** | Renders the `Captions` icon, calls `onSubtitles` if provided, otherwise a no-op | A subtitle-track selection sheet/dialog (list tracks from the Jellyfin playback session, call a track-select API) |
| **Audio** | Renders the `Music` icon, calls `onAudio` if provided, otherwise a no-op | An audio-track selection sheet/dialog, same shape as subtitles |
| **Settings** | Renders the `Settings` (gear) icon, calls `onSettings` if provided, otherwise a no-op | A playback-settings sheet (quality/bitrate, playback speed, etc.) |
| **Favorite persistence** | Heart icon toggles locally (`isFavorite` prop) with a pop animation; `onToggleFavorite` is caller-supplied | A backend field/endpoint to persist favorite state (Jellyfin `UserData.IsFavorite` or a Lolarr-side store) plus wiring from the playback/detail screen |
| **Volume/mute icon** | `Volume2` icon is present but its press handler is a no-op; the slider next to it carries live volume | A mute toggle handler (remember last volume, drive the existing `onVolume`) |

### "Merken" / watchlist persistence

The Detail screen renders the bare, animated-heart "Merken" action from the design spec, and it
toggles (heart fills + `fav-pop` animation) — but as **local UI state only** (`LibraryDetailScreen`,
`// TODO(watchlist)`). There is no watchlist backend: nothing persists across reloads, and no
Seerr/Jellyfin-backed list exists. Wiring it needs a per-user watchlist data model, an API endpoint
to add/remove/list, and then swapping the local `useState` for that call (same optimistic-toggle
shape as the player's favorite heart).

### Rating & genre in the detail meta row

The abyss mockup's detail meta row shows a star rating (`★ 8.7`) and genre alongside year and the
season/episode counts. Neither is rendered, because the `MediaItem` domain type
(`packages/domain/src/index.ts`) carries no `rating`/`voteAverage` or `genres` field. Surfacing them
needs those fields added to the schema and mapped through the BFF from Jellyfin/Seerr before the UI
can show them. Everything else in that row (year, `N Staffeln · M Folgen`, inline availability chip)
is live.

## Testing

Component tests live in `packages/ui/tests/` (Vitest + Testing Library, `jsdom`). Run with:

```bash
pnpm --filter @lolarr/ui test
```
