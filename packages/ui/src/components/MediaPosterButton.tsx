import type { MediaItem } from '@lolarr/domain'
import type { ActionComponent } from './types'
import { labelForAvailability } from './availabilityLabels'
import { Play } from '../lib/icons'

// Anything not directly watchable-in-full carries a small bare status LED in the
// corner — never a dark frosted pill.
const OVERLAY_AVAILABILITY = new Set<MediaItem['availability']>([
  'processing',
  'requested',
  'requestable',
  'unavailable',
])

// Bare LED colour per state (mirrors StatusBadge's dot vocabulary).
const DOT_CLASS: Record<MediaItem['availability'], string> = {
  available: 'bg-status-available',
  partiallyAvailable: 'bg-status-pending',
  processing: 'bg-status-processing',
  requested: 'bg-status-requested',
  requestable: 'bg-muted-foreground',
  unavailable: 'bg-muted-foreground',
}

// Two shapes, one focus target (Select opens details / resumes):
//   • portrait  — a poster that morphs to a landscape preview on hover/focus
//     (see `.lolarr-card*` in theme.css); no caption, title lives in the overlay.
//   • landscape — a fixed 16:9 card with a caption underneath, matching the
//     detail-screen episode grid (used for the "Continue watching" rail, whose
//     images are landscape stills anyway). Ring + scale like an episode card.
export function MediaPosterButton({
  item,
  onOpen,
  Action,
  focusKeyPrefix,
  variant = 'portrait',
}: {
  item: MediaItem
  onOpen: (item: MediaItem) => void
  Action: ActionComponent
  focusKeyPrefix: string
  variant?: 'portrait' | 'landscape'
}) {
  const metaLine = item.jellyfin?.episode
    ? `S${item.jellyfin.episode.season} · E${item.jellyfin.episode.number}`
    : item.year
      ? String(item.year)
      : null

  const progress = item.jellyfin?.progressPercent

  if (variant === 'landscape') {
    // Prefer a landscape source (backdrop / episode still) over a portrait poster.
    const landscapeUrl = item.backdropUrl ?? item.posterUrl
    return (
      <Action
        variant="card"
        className="group block w-[400px] shrink-0 text-left transition-transform duration-[370ms] ease-out-expo hover:scale-[1.03] focused:scale-[1.03] focused:bg-transparent"
        onPress={() => onOpen(item)}
        focusKey={`${focusKeyPrefix}-${item.id}`}
        ariaLabel={`${item.title} öffnen`}
      >
        <span className="lolarr-art relative block aspect-video w-full overflow-hidden rounded-md bg-surface">
          {landscapeUrl ? (
            <img src={landscapeUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center p-3 text-center text-3xl font-semibold text-muted-foreground">
              {item.title.slice(0, 1)}
            </span>
          )}
          {progress !== undefined ? (
            <span className="absolute inset-x-0 bottom-0 h-1 bg-black/40" aria-hidden="true">
              <span className="block h-full bg-primary" style={{ width: `${progress}%` }} />
            </span>
          ) : null}
        </span>
        <span className="mt-3 block">
          <span className="block truncate text-sm font-medium">{item.title}</span>
          {metaLine ? <span className="mt-1 block text-xs text-foreground/40">{metaLine}</span> : null}
        </span>
      </Action>
    )
  }

  const hasBackdrop = Boolean(item.backdropUrl)
  return (
    <div className="lolarr-card-slot">
      <Action
        variant="card"
        className={`lolarr-card focused:scale-100 focused:bg-transparent focus-visible:ring-0${
          hasBackdrop ? ' has-backdrop' : ''
        }`}
        onPress={() => onOpen(item)}
        focusKey={`${focusKeyPrefix}-${item.id}`}
        ariaLabel={`${item.title} öffnen`}
      >
        {item.posterUrl ? (
          <img src={item.posterUrl} alt="" loading="lazy" decoding="async" className="lolarr-poster" />
        ) : (
          <span className="lolarr-poster flex items-center justify-center bg-surface p-3 text-center text-3xl font-semibold text-muted-foreground">
            {item.title.slice(0, 1)}
          </span>
        )}
        {hasBackdrop ? (
          <img src={item.backdropUrl} alt="" loading="lazy" decoding="async" className="lolarr-backdrop" />
        ) : null}

        {/* Landscape-state overlay — title, meta, and the "opens details" hint,
            revealed only when the card expands. */}
        <span className="lolarr-overlay absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pt-12">
          <span className="truncate text-base font-semibold text-white">{item.title}</span>
          <span className="flex items-center gap-2 text-xs text-white/70">
            {metaLine ? <span className="truncate">{metaLine}</span> : null}
            <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-white/90">
              <Play className="size-3" fill="currentColor" strokeWidth={0} />
              Details
            </span>
          </span>
        </span>

        {OVERLAY_AVAILABILITY.has(item.availability) ? (
          <span
            className={`absolute top-2 right-2 z-10 size-[9px] rounded-full ring-2 ring-black/25 ${DOT_CLASS[item.availability]}`}
            aria-label={labelForAvailability(item.availability)}
          />
        ) : null}
        {progress !== undefined ? (
          <span className="absolute inset-x-0 bottom-0 z-10 h-1 bg-black/40" aria-hidden="true">
            <span className="block h-full bg-primary" style={{ width: `${progress}%` }} />
          </span>
        ) : null}
      </Action>
    </div>
  )
}
