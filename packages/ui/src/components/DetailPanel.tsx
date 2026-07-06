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
  // Optional, additive: when the item is already playable in Jellyfin, the
  // caller can wire a primary Play/Continue CTA (same pattern as
  // HeroPanel.onPlay). Omitted for the current Seerr-discovery call site,
  // which has no playback concept — see DetailScreen.
  onPlay?: (item: MediaItem) => void
}

export function DetailPanel({
  item,
  isRequesting,
  requestError,
  onBack,
  onRequest,
  Action,
  onPlay,
}: DetailPanelProps) {
  const canRequest =
    item.availability === 'requestable' ||
    item.availability === 'unavailable' ||
    (item.mediaType === 'tv' && item.availability === 'partiallyAvailable')

  // The request/save action is a focus target, not the loudest thing on
  // screen: it's primary only when there is no dedicated Play CTA (the
  // current Seerr-request-only call site). Once a caller wires onPlay, Play
  // takes the single primary slot and the request action becomes bare.
  const requestVariant = onPlay ? 'ghost' : 'primary'

  return (
    <section className="flex flex-col gap-8">
      <div className="relative min-h-[48vh] rounded-lg overflow-hidden">
        {item.backdropUrl ? (
          <img src={item.backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
      </div>
      <div className="relative z-10 p-12 flex flex-col gap-4 max-w-2xl">
        <Action variant="secondary" onPress={onBack} focusKey="detail-back">
          Back
        </Action>
        <div className="grid grid-cols-[240px_1fr] gap-8 items-start">
          <div>
            {item.posterUrl ? (
              <img
                src={item.posterUrl}
                alt=""
                className="aspect-[2/3] w-full rounded-md object-cover ring-1 ring-inset ring-white/10"
              />
            ) : null}
          </div>
          <div>
            <StatusBadge availability={item.availability} />
            <h2 className="text-4xl font-semibold tracking-tight">{item.title}</h2>
            <p className="text-muted-foreground">{item.overview}</p>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {item.year ? <span>{item.year}</span> : null}
              <span>{item.mediaType === 'movie' ? 'Movie' : 'Series'}</span>
              {item.tmdbId !== undefined ? <span>TMDB {item.tmdbId}</span> : null}
            </div>
            <div className="flex items-center gap-3 pt-1">
              {onPlay ? (
                <Action variant="primary" onPress={() => onPlay(item)} focusKey="detail-play">
                  {item.jellyfin?.progressPercent !== undefined ? 'Fortsetzen' : 'Abspielen'}
                </Action>
              ) : null}
              <Action
                variant={requestVariant}
                disabled={!canRequest || isRequesting}
                onPress={() => onRequest(item)}
                focusKey={`request-${item.mediaType}-${item.tmdbId}`}
              >
                {requestLabel(item.mediaType, item.availability, Boolean(isRequesting))}
              </Action>
            </div>
            {requestError ? <p className="text-sm text-danger">{requestError}</p> : null}
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
    return mediaType === 'tv' ? 'Weitere Staffeln anfragen' : 'Available in Jellyfin'
  }

  if (availability === 'requested') {
    return 'Already requested'
  }

  if (availability === 'processing') {
    return 'Processing'
  }

  return 'Request in Seerr'
}
