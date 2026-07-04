import type { Availability, MediaItem, MediaType } from '@lolarr/domain'
import type { ActionComponent } from './types'
import { StatusBadge } from './StatusBadge'

type DetailPanelProps = {
  item: MediaItem
  isRequesting?: boolean
  requestError?: string
  onBack: () => void
  onRequest: (item: MediaItem) => void
  Action: ActionComponent
}

export function DetailPanel({
  item,
  isRequesting,
  requestError,
  onBack,
  onRequest,
  Action,
}: DetailPanelProps) {
  const canRequest =
    item.availability === 'requestable' ||
    item.availability === 'unavailable' ||
    (item.mediaType === 'tv' && item.availability === 'partiallyAvailable')

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
              {item.tmdbId !== undefined ? <span>TMDB {item.tmdbId}</span> : null}
            </div>
            <Action
              className="primary-action"
              disabled={!canRequest || isRequesting}
              onPress={() => onRequest(item)}
              focusKey={`request-${item.mediaType}-${item.tmdbId}`}
            >
              {requestLabel(item.mediaType, item.availability, Boolean(isRequesting))}
            </Action>
            {requestError ? <p className="request-error">{requestError}</p> : null}
          </div>
        </div>
      </div>
    </section>
  )
}

function requestLabel(mediaType: MediaType, availability: Availability, isRequesting: boolean) {
  if (isRequesting) {
    return 'Requesting...'
  }

  if (availability === 'available') {
    return 'Available in Jellyfin'
  }

  if (availability === 'partiallyAvailable') {
    return mediaType === 'tv' ? 'Request more seasons' : 'Available in Jellyfin'
  }

  if (availability === 'requested') {
    return 'Already requested'
  }

  if (availability === 'processing') {
    return 'Processing'
  }

  return 'Request in Seerr'
}
