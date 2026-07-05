import { useMemo, useState } from 'react'
import { readJellyfinSession } from '@lolarr/jellyfin'
import {
  AppFrame,
  EpisodeList,
  ErrorPanel,
  LoadingPanel,
  SeasonSelector,
  type ActionComponent,
  type NavItem,
} from '@lolarr/ui'
import { readErrorMessage } from '../lib/errors.js'
import { resolveItemImages } from '../lib/images.js'
import { useNotificationsContext } from '../notifications/NotificationsProvider.js'
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
  onPlay,
  onOpenHome,
  onOpenSearch,
  onOpenRequests,
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
  onPlay: (opts: { itemId: string; title?: string; resumeTicks?: number; seriesId?: string }) => void
  onOpenHome?: () => void
  onOpenSearch?: () => void
  onOpenRequests?: () => void
}) {
  const detailQuery = useLibraryDetail({ apiBaseUrl, itemId })
  const jellyfinSession = useMemo(() => readJellyfinSession(storage), [storage])
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>()
  const { unreadCount } = useNotificationsContext()

  const navItems: NavItem[] = [
    { key: 'home', label: 'Start', onPress: () => onOpenHome?.() },
    {
      key: 'requests',
      label: 'Anfragen',
      onPress: () => onOpenRequests?.(),
      badge: unreadCount || undefined,
    },
  ]

  const frameProps = {
    Action,
    navItems,
    userName,
    onSignOut,
    onOpenSearch,
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
        <ErrorPanel
          message={detailQuery.error ? readErrorMessage(detailQuery.error) : 'Item not found'}
          Action={Action}
          onRetry={detailQuery.error ? () => void detailQuery.refetch() : undefined}
        />
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
        className="relative overflow-hidden rounded-lg bg-cover bg-center"
        style={images.backdropUrl ? { backgroundImage: `url(${images.backdropUrl})` } : undefined}
      >
        <div className="max-w-[60%] bg-gradient-to-r from-background/90 via-background/60 to-background/20 p-12">
          <h1>{item.title}</h1>
          <p className="text-muted-foreground">{item.year ?? ''}</p>
          <p>{item.overview}</p>
          <div className="mt-4 flex gap-3">
            {item.mediaType === 'movie' ? (
              <Action
                variant="primary"
                onPress={() =>
                  onPlay({
                    itemId: item.jellyfin?.itemId ?? itemId,
                    title: item.title,
                    resumeTicks: item.jellyfin?.resumePositionTicks,
                    seriesId: item.jellyfin?.seriesId,
                  })
                }
                focusKey="library-play"
                ariaLabel="Play"
              >
                ▶ Play
              </Action>
            ) : null}
            {item.mediaType === 'movie' && item.jellyfin?.resumePositionTicks ? (
              <Action
                onPress={() =>
                  onPlay({ itemId: item.jellyfin?.itemId ?? itemId, title: item.title, seriesId: item.jellyfin?.seriesId })
                }
                focusKey="library-play-restart"
              >
                Start from beginning
              </Action>
            ) : null}
            <Action onPress={onBack} focusKey="library-back">
              Back
            </Action>
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
          <EpisodeList
            episodes={season.episodes}
            Action={Action}
            onPlay={(episode) =>
              onPlay({
                itemId: episode.jellyfinItemId,
                title: episode.title,
                resumeTicks: episode.resumePositionTicks,
                seriesId: itemId,
              })
            }
          />
        </>
      ) : null}
    </AppFrame>
  )
}
