import type { MediaItem } from '@lolarr/domain'
import type { ActionComponent } from './types'
import { labelForAvailability } from './availabilityLabels'

export function MediaPosterButton({
  item,
  onOpen,
  Action,
}: {
  item: MediaItem
  onOpen: (item: MediaItem) => void
  Action: ActionComponent
}) {
  return (
    <Action
      className="media-card"
      onPress={() => onOpen(item)}
      focusKey={`card-${item.mediaType}-${item.tmdbId}`}
      ariaLabel={`Open ${item.title}`}
    >
      <span className="poster-frame">
        {item.posterUrl ? (
          <img src={item.posterUrl} alt="" loading="lazy" />
        ) : (
          <span className="poster-fallback">{item.title.slice(0, 1)}</span>
        )}
      </span>
      <span className="media-card-title">{item.title}</span>
      <span className="media-card-meta">
        {item.year ? `${item.year} · ` : ''}
        {labelForAvailability(item.availability)}
      </span>
    </Action>
  )
}
