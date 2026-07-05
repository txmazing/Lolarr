import type { MediaItem } from '@lolarr/domain'
import type { ActionComponent } from './types'
import { StatusBadge } from './StatusBadge'

export function MediaPosterButton({
  item,
  onOpen,
  Action,
  focusKeyPrefix,
}: {
  item: MediaItem
  onOpen: (item: MediaItem) => void
  Action: ActionComponent
  focusKeyPrefix: string
}) {
  return (
    <Action
      variant="card"
      className="group relative w-40 shrink-0 rounded-md transition-transform duration-[350ms] ease-out-expo hover:scale-[1.06] focused:scale-[1.06] focused:outline focused:outline-2 focused:outline-ring"
      onPress={() => onOpen(item)}
      focusKey={`${focusKeyPrefix}-${item.id}`}
      ariaLabel={`Open ${item.title}`}
    >
      <span className="relative aspect-[2/3] overflow-hidden rounded-md bg-surface border block">
        {item.posterUrl ? (
          <img src={item.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center p-3 text-center text-sm text-muted-foreground">
            {item.title.slice(0, 1)}
          </span>
        )}
        {item.jellyfin?.progressPercent !== undefined ? (
          <span className="absolute bottom-0 inset-x-0 h-1 bg-surface-3" aria-hidden="true">
            <span
              className="h-full bg-primary block"
              style={{ width: `${item.jellyfin.progressPercent}%` }}
            />
          </span>
        ) : null}
      </span>
      <span className="mt-2 truncate text-sm font-medium block">{item.title}</span>
      <span className="text-xs text-muted-foreground flex items-center gap-2">
        {item.year ? <span>{item.year}</span> : null}
        <StatusBadge availability={item.availability} />
      </span>
      {item.jellyfin?.episode ? (
        <span className="block text-xs text-muted-foreground mt-1">{`S${item.jellyfin.episode.season} · E${item.jellyfin.episode.number}`}</span>
      ) : null}
    </Action>
  )
}
