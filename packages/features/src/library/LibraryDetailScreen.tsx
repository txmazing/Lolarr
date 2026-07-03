import { useMemo, useState } from 'react'
import { readJellyfinSession } from '@lolarr/jellyfin'
import {
  AppFrame,
  EpisodeList,
  ErrorPanel,
  LoadingPanel,
  SeasonSelector,
  type ActionComponent,
} from '@lolarr/ui'
import { readErrorMessage } from '../lib/errors.js'
import { resolveItemImages } from '../lib/images.js'
import type { KeyValueStorage } from '../storage.js'
import { useLibraryDetail } from './useLibraryDetail.js'

export function LibraryDetailScreen({
  Action,
  apiBaseUrl,
  storage,
  itemId,
  userName,
  onSignOut,
  canConfigureGateway,
  onConfigureGateway,
  onBack,
}: {
  Action: ActionComponent
  apiBaseUrl: string
  storage: KeyValueStorage
  itemId: string
  userName: string
  onSignOut: () => void
  canConfigureGateway: boolean
  onConfigureGateway: () => void
  onBack: () => void
}) {
  const detailQuery = useLibraryDetail({ apiBaseUrl, itemId })
  const jellyfinSession = useMemo(() => readJellyfinSession(storage), [storage])
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>()

  const frameProps = {
    Action,
    userName,
    onSignOut,
    onConfigureGateway: canConfigureGateway ? onConfigureGateway : undefined,
  }

  if (detailQuery.isLoading) {
    return (
      <AppFrame {...frameProps}>
        <LoadingPanel />
      </AppFrame>
    )
  }

  const data = detailQuery.data
  if (!data) {
    return (
      <AppFrame {...frameProps}>
        <ErrorPanel message={detailQuery.error ? readErrorMessage(detailQuery.error) : 'Item not found'} />
        <Action onPress={onBack} focusKey="library-back">Back</Action>
      </AppFrame>
    )
  }

  const { item, seasons } = data
  const images = resolveItemImages(item, jellyfinSession)
  const season = seasons?.find((s) => s.id === selectedSeasonId) ?? seasons?.[0]

  return (
    <AppFrame {...frameProps}>
      <section
        className="library-detail"
        style={images.backdropUrl ? { backgroundImage: `url(${images.backdropUrl})` } : undefined}
      >
        <div className="library-detail-content">
          <h1>{item.title}</h1>
          <p className="library-detail-meta">{item.year ?? ''}</p>
          <p>{item.overview}</p>
          <div className="library-detail-actions">
            <Action onPress={() => {}} disabled focusKey="library-play" ariaLabel="Play (coming soon)">
              ▶ Play (coming soon)
            </Action>
            <Action onPress={onBack} focusKey="library-back">Back</Action>
          </div>
        </div>
      </section>
      {seasons && seasons.length > 0 && season ? (
        <>
          <SeasonSelector
            Action={Action}
            seasons={seasons.map(({ id, name }) => ({ id, name }))}
            selectedId={season.id}
            onSelect={setSelectedSeasonId}
          />
          <EpisodeList episodes={season.episodes} />
        </>
      ) : null}
    </AppFrame>
  )
}
