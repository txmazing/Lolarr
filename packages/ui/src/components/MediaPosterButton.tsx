import type { MediaItem } from '@lolarr/domain'
import type { ActionComponent } from './types'
import { labelForAvailability } from './availabilityLabels'

// Library titles render clean (no status chip); anything not directly
// watchable-in-full carries a small frosted indicator overlaid on the poster.
const OVERLAY_AVAILABILITY = new Set<MediaItem['availability']>([
  'processing',
  'requested',
  'requestable',
  'unavailable',
])

export function MediaPosterButton({
  item,
  onOpen,
  Action,
  focusKeyPrefix,
  orientation = 'portrait',
}: {
  item: MediaItem
  onOpen: (item: MediaItem) => void
  Action: ActionComponent
  focusKeyPrefix: string
  orientation?: 'portrait' | 'landscape'
}) {
  const metaLine = item.jellyfin?.episode
    ? `S${item.jellyfin.episode.season} · E${item.jellyfin.episode.number}`
    : item.year
      ? String(item.year)
      : null

  const aspectClass = orientation === 'landscape' ? 'aspect-video' : 'aspect-[2/3]'

  return (
    <Action
      variant="card"
      className="group w-40 shrink-0 transition-transform duration-[350ms] ease-out-expo hover:scale-[1.06] focused:scale-[1.06]"
      onPress={() => onOpen(item)}
      focusKey={`${focusKeyPrefix}-${item.id}`}
      ariaLabel={`${item.title} öffnen`}
    >
      {/* No hard border or shadow; a faint inset ring sits under the poster
          and brightens on hover/focus instead. */}
      <span
        className={`relative block ${aspectClass} w-full overflow-hidden rounded-md bg-surface ring-1 ring-inset ring-white/[0.06] shadow-[inset_0_0_3px_rgb(200_200_200/0.35)] transition-[box-shadow] duration-200 group-hover:ring-2 group-hover:ring-white/30 focused:ring-2 focused:ring-white/30`}
      >
        {item.posterUrl ? (
          <img src={item.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center p-3 text-center text-2xl font-semibold text-muted-foreground">
            {item.title.slice(0, 1)}
          </span>
        )}
        {OVERLAY_AVAILABILITY.has(item.availability) ? (
          <span className="glass-controls absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-medium">
            {labelForAvailability(item.availability)}
          </span>
        ) : null}
        {item.jellyfin?.progressPercent !== undefined ? (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-black/40" aria-hidden="true">
            <span
              className="block h-full bg-primary"
              style={{ width: `${item.jellyfin.progressPercent}%` }}
            />
          </span>
        ) : null}
      </span>
      <span className="mt-2 block w-full truncate text-sm font-semibold">{item.title}</span>
      {metaLine ? (
        <span className="block text-xs font-light text-muted-foreground">{metaLine}</span>
      ) : null}
    </Action>
  )
}
