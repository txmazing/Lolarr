import type { MediaItem } from '@lolarr/domain'
import type { ActionComponent } from './types'
import { StatusBadge } from './StatusBadge'

type HeroProps = {
  item?: MediaItem
  onOpen: (item: MediaItem) => void
  Action: ActionComponent
}

export function HeroPanel({ item, onOpen, Action }: HeroProps) {
  if (!item) {
    return (
      <section className="hero-panel skeleton-panel">
        <p className="eyebrow">Discover</p>
        <h2>Loading your next title...</h2>
      </section>
    )
  }

  return (
    <section
      className="hero-panel"
      style={{
        backgroundImage: item.backdropUrl
          ? `linear-gradient(90deg, rgba(8, 10, 14, 0.96), rgba(8, 10, 14, 0.66), rgba(8, 10, 14, 0.16)), url(${item.backdropUrl})`
          : undefined,
      }}
    >
      <div className="hero-copy">
        {item.jellyfin?.progressPercent !== undefined || item.jellyfin?.episode ? (
          <span className="hero-badge">Continue watching</span>
        ) : null}
        <StatusBadge availability={item.availability} />
        <h2>{item.title}</h2>
        {item.jellyfin?.episode ? (
          <p className="poster-subtitle">
            {`${item.jellyfin.episode.seriesTitle} · S${item.jellyfin.episode.season} · E${item.jellyfin.episode.number}`}
          </p>
        ) : null}
        <p>{item.overview}</p>
        <div className="hero-meta">
          {item.year ? <span>{item.year}</span> : null}
          <span>{item.mediaType === 'movie' ? 'Movie' : 'Series'}</span>
        </div>
        <Action
          className="primary-action"
          onPress={() => onOpen(item)}
          focusKey="hero"
        >
          Open details
        </Action>
      </div>
    </section>
  )
}
