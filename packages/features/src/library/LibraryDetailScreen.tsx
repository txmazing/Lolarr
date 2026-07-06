import { useMemo, useState } from 'react'
import { readJellyfinSession } from '@lolarr/jellyfin'
import {
  AppFrame,
  EpisodeList,
  ErrorPanel,
  LoadingPanel,
  SeasonSelector,
  StatusBadge,
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
        <Action variant="ghost" onPress={onBack} focusKey="library-back">
          Back
        </Action>
      </AppFrame>
    )
  }

  const { item, seasons } = data
  const images = resolveItemImages(item, jellyfinSession)
  const season = seasons?.find((s) => s.id === selectedSeasonId) ?? seasons?.[0]

  return (
    <AppFrame {...frameProps}>
      <section className="relative min-h-[48vh] overflow-hidden rounded-lg">
        {images.backdropUrl ? (
          <img src={images.backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
        <div className="relative z-10 flex max-w-2xl flex-col gap-4 p-12">
          <StatusBadge availability={item.availability} />
          <h1 className="text-4xl font-semibold tracking-tight">{item.title}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {item.year ? <span>{item.year}</span> : null}
            <span>{item.mediaType === 'movie' ? 'Movie' : 'Series'}</span>
          </div>
          <p className="text-muted-foreground">{item.overview}</p>
          <div className="flex items-center gap-3 pt-1">
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
                {item.jellyfin?.resumePositionTicks ? 'Fortsetzen' : 'Play'}
              </Action>
            ) : null}
            {item.mediaType === 'movie' && item.jellyfin?.resumePositionTicks ? (
              <Action
                variant="ghost"
                onPress={() =>
                  onPlay({ itemId: item.jellyfin?.itemId ?? itemId, title: item.title, seriesId: item.jellyfin?.seriesId })
                }
                focusKey="library-play-restart"
              >
                Start from beginning
              </Action>
            ) : null}
            <Action variant="ghost" onPress={onBack} focusKey="library-back">
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
