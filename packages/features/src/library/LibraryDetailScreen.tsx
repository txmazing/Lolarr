import { useMemo, useState } from 'react'
import type { Episode } from '@lolarr/domain'
import { buildImageUrl, readJellyfinSession } from '@lolarr/jellyfin'
import {
  AppFrame,
  ArrowLeft,
  EpisodeList,
  ErrorPanel,
  Heart,
  LoadingPanel,
  Play,
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
  // Watchlist ("Merken") has no backend yet — the button toggles local UI only.
  // TODO(watchlist): persist via a real /api/watchlist endpoint.
  const [saved, setSaved] = useState(false)
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

  const ep = item.jellyfin?.episode
  const hasResume = item.jellyfin?.resumePositionTicks !== undefined
  // Play/Fortsetzen shows for anything with a playable Jellyfin item — movies
  // and series alike (series resolve to their next-up/resume item on the BFF).
  const hasPlayable = Boolean(item.jellyfin?.itemId)
  const kicker = `${item.mediaType === 'movie' ? 'Film' : 'Serie'}${item.year ? ` · ${item.year}` : ''}`
  const seasonCount = seasons?.length ?? 0
  const episodeCount = seasons?.reduce((total, s) => total + s.episodes.length, 0) ?? 0
  const metaCounts =
    seasonCount > 0
      ? `${seasonCount} ${seasonCount === 1 ? 'Staffel' : 'Staffeln'} · ${episodeCount} ${episodeCount === 1 ? 'Folge' : 'Folgen'}`
      : null
  const playLabel = hasResume
    ? ep
      ? `Fortsetzen · S${ep.season} F${ep.number}`
      : 'Fortsetzen'
    : ep
      ? `Abspielen · S${ep.season} F${ep.number}`
      : 'Abspielen'
  const playCurrent = () =>
    onPlay({
      itemId: item.jellyfin?.itemId ?? itemId,
      title: item.title,
      resumeTicks: item.jellyfin?.resumePositionTicks,
      seriesId: item.jellyfin?.seriesId,
    })
  const stillUrlFor = (episode: Episode) =>
    jellyfinSession && episode.imageTag
      ? buildImageUrl(jellyfinSession, episode.jellyfinItemId, 'Primary', episode.imageTag, {
          width: 640,
        })
      : undefined

  return (
    <AppFrame {...frameProps}>
      {/* Cinematic hero: full-bleed backdrop under the fixed nav (-mt-24),
          content anchored bottom-left, actions as focus targets (mockup). */}
      <section className="relative -mt-24 h-[76vh] min-h-[560px] w-full overflow-hidden">
        {images.backdropUrl ? (
          <img src={images.backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-surface" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-background/25 to-transparent" />
        <div className="absolute top-24 left-8 z-10">
          <Action
            variant="ghost"
            className="h-11 w-11 p-0"
            onPress={onBack}
            focusKey="library-back"
            ariaLabel="Zurück"
          >
            <ArrowLeft />
          </Action>
        </div>
        <div className="absolute inset-x-0 bottom-0 z-10 flex max-w-3xl flex-col gap-4 px-12 pb-14">
          <p className="text-xs tracking-[0.16em] text-foreground/40 uppercase">{kicker}</p>
          <h1 className="max-w-[15ch] text-5xl font-semibold tracking-tight text-balance md:text-6xl">
            {item.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {item.year ? <span>{item.year}</span> : null}
            {metaCounts ? (
              <>
                <span className="size-1 rounded-full bg-foreground/30" aria-hidden="true" />
                <span>{metaCounts}</span>
              </>
            ) : null}
            <StatusBadge availability={item.availability} />
          </div>
          <p className="max-w-[56ch] leading-relaxed text-muted-foreground">{item.overview}</p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {hasPlayable ? (
              <Action variant="primary" onPress={playCurrent} focusKey="library-play" ariaLabel={playLabel}>
                <Play fill="currentColor" strokeWidth={0} />
                {playLabel}
              </Action>
            ) : null}
            <Action
              variant="glass"
              className="h-11 w-11 p-0"
              onPress={() => setSaved((value) => !value)}
              focusKey="library-save"
              ariaLabel={saved ? 'Gemerkt' : 'Merken'}
            >
              <Heart className={saved ? 'fav-pop fill-current' : undefined} />
            </Action>
          </div>
        </div>
      </section>
      {seasons && seasons.length > 0 && season ? (
        <section className="flex flex-col gap-5 px-12 pt-10 pb-16">
          <h2 className="text-lg font-semibold">Staffeln &amp; Folgen</h2>
          <SeasonSelector
            Action={Action}
            seasons={seasons.map(({ id, name }) => ({ id, name }))}
            selectedId={season.id}
            onSelect={setSelectedSeasonId}
          />
          <EpisodeList
            episodes={season.episodes}
            Action={Action}
            stillUrl={stillUrlFor}
            onPlay={(episode) =>
              onPlay({
                itemId: episode.jellyfinItemId,
                title: episode.title,
                resumeTicks: episode.resumePositionTicks,
                seriesId: itemId,
              })
            }
          />
        </section>
      ) : null}
    </AppFrame>
  )
}
