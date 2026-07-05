import { useMemo } from 'react'
import type { MediaItem } from '@lolarr/domain'
import { readJellyfinSession } from '@lolarr/jellyfin'
import {
  AppFrame,
  ErrorPanel,
  HeroPanel,
  LoadingPanel,
  MediaRail,
  RequestList,
  type ActionComponent,
  type NavItem,
} from '@lolarr/ui'
import { enrichItems, resolveItemImages } from '../lib/images.js'
import { readErrorMessage } from '../lib/errors.js'
import { useNotificationsContext } from '../notifications/NotificationsProvider.js'
import { useRequests } from '../requests/useRequests.js'
import type { KeyValueStorage } from '../storage.js'
import { useHome } from './useHome.js'

export function HomeScreen({
  Action,
  storage,
  apiBaseUrl,
  userName,
  onSignOut,
  canConfigureGateway,
  onConfigureGateway,
  onOpenItem,
  onPlayItem,
  onOpenSearch,
  onOpenRequests,
}: {
  Action: ActionComponent
  storage: KeyValueStorage
  apiBaseUrl: string
  userName: string
  onSignOut: () => void
  canConfigureGateway: boolean
  onConfigureGateway: () => void
  onOpenItem: (item: MediaItem) => void
  onPlayItem: (item: MediaItem) => void
  onOpenSearch: () => void
  onOpenRequests: () => void
}) {
  const homeQuery = useHome({ apiBaseUrl })
  // Read once per mount: HomeScreen only mounts after login, when lolarr.jellyfin is already persisted. If this screen ever survives a re-auth, switch to a subscribed read.
  const jellyfinSession = useMemo(() => readJellyfinSession(storage), [storage])

  const { requests, requestsError } = useRequests({ apiBaseUrl, enabled: true })
  const { unreadCount } = useNotificationsContext()

  const enrichedHome = useMemo(() => {
    const rows = (homeQuery.data?.rows ?? []).map((row) => ({
      ...row,
      items: enrichItems(row.items, jellyfinSession),
    }))
    const heroSource = homeQuery.data?.hero
    const hero = heroSource
      ? { ...heroSource, ...resolveItemImages(heroSource, jellyfinSession) }
      : undefined
    return { rows, hero }
  }, [homeQuery.data, jellyfinSession])

  const rows = enrichedHome.rows
  const featuredItem = enrichedHome.hero ?? rows[0]?.items[0]

  const navItems: NavItem[] = [
    { key: 'home', label: 'Home', onPress: () => {}, active: true },
    { key: 'search', label: 'Suche', onPress: onOpenSearch },
    { key: 'requests', label: 'Anfragen', onPress: onOpenRequests, badge: unreadCount || undefined },
  ]

  return (
    <AppFrame
      Action={Action}
      navItems={navItems}
      onSearch={onOpenSearch}
      onConfigureGateway={canConfigureGateway ? onConfigureGateway : undefined}
      userName={userName}
      onSignOut={onSignOut}
    >
      <HeroPanel
        item={featuredItem}
        onOpen={
          featuredItem?.jellyfin && (featuredItem.mediaType === 'movie' || featuredItem.jellyfin.episode)
            ? onPlayItem
            : onOpenItem
        }
        Action={Action}
      />
      <div className="flex flex-col gap-10 pb-16 pt-6">
        {homeQuery.error ? (
          <div className="px-12">
            <ErrorPanel
              message={readErrorMessage(homeQuery.error)}
              Action={Action}
              onRetry={() => void homeQuery.refetch()}
            />
          </div>
        ) : null}
        {homeQuery.isLoading ? <LoadingPanel /> : null}
        {rows.map((row) => (
          <MediaRail
            key={row.id}
            id={row.id}
            title={row.title}
            items={row.items}
            onOpen={row.id === 'continue-watching' ? onPlayItem : onOpenItem}
            Action={Action}
          />
        ))}
        {requestsError ? null : (
          <div className="px-12">
            <RequestList requests={requests} Action={Action} limit={3} onViewAll={onOpenRequests} />
          </div>
        )}
      </div>
    </AppFrame>
  )
}
