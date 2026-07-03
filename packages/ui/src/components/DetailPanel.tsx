import type { Availability, MediaItem } from '@lolarr/domain'
import type { ActionComponent } from './types'
import { StatusBadge } from './StatusBadge'

type DetailPanelProps = {
  item: MediaItem
  isRequesting?: boolean
  onBack: () => void
  onRequest: (item: MediaItem) => void
  Action: ActionComponent
}

export function DetailPanel({
  item,
  isRequesting,
  onBack,
  onRequest,
  Action,
}: DetailPanelProps) {
  const canRequest =
    item.availability === 'requestable' || item.availability === 'unavailable'

  return (
    <section className="detail-panel">
      <div className="detail-backdrop">
        {item.backdropUrl ? <img src={item.backdropUrl} alt="" /> : null}
      </div>
      <div className="detail-content">
        <Action className="ghost-action" onPress={onBack} focusKey="detail-back">
          Back
        </Action>
        <div className="detail-grid">
          <div className="detail-poster">
            {item.posterUrl ? <img src={item.posterUrl} alt="" /> : null}
          </div>
          <div>
            <StatusBadge availability={item.availability} />
            <h2>{item.title}</h2>
            <p>{item.overview}</p>
            <div className="hero-meta">
              {item.year ? <span>{item.year}</span> : null}
              <span>{item.mediaType === 'movie' ? 'Movie' : 'Series'}</span>
              <span>TMDB {item.tmdbId}</span>
            </div>
            <Action
              className="primary-action"
              disabled={!canRequest || isRequesting}
              onPress={() => onRequest(item)}
              focusKey={`request-${item.mediaType}-${item.tmdbId}`}
            >
              {requestLabel(item.availability, Boolean(isRequesting))}
            </Action>
          </div>
        </div>
      </div>
    </section>
  )
}

function requestLabel(availability: Availability, isRequesting: boolean) {
  if (isRequesting) {
    return 'Requesting...'
  }

  if (availability === 'available' || availability === 'partiallyAvailable') {
    return 'Available in Jellyfin'
  }

  if (availability === 'requested') {
    return 'Already requested'
  }

  if (availability === 'processing') {
    return 'Processing'
  }

  return 'Request in Seerr'
}
