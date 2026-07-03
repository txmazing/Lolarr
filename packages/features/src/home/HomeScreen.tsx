import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useMemo, useState } from 'react'
import type { MediaItem } from '@lolarr/domain'
import { readJellyfinSession } from '@lolarr/jellyfin'
import {
  AppFrame,
  ErrorPanel,
  HeroPanel,
  LoadingPanel,
  MediaRail,
  RequestList,
  SearchBar,
  type ActionComponent,
  type TextInputComponent,
} from '@lolarr/ui'
import { useApi } from '../api.js'
import { enrichItems, resolveItemImages } from '../lib/images.js'
import { readErrorMessage } from '../lib/errors.js'
import { useRequests } from '../requests/useRequests.js'
import type { KeyValueStorage } from '../storage.js'
import { useHome } from './useHome.js'

export function HomeScreen({
  Action,
  TextInput,
  storage,
  apiBaseUrl,
  userName,
  onSignOut,
  canConfigureGateway,
  onConfigureGateway,
  onOpenItem,
}: {
  Action: ActionComponent
  TextInput: TextInputComponent
  storage: KeyValueStorage
  apiBaseUrl: string
  userName: string
  onSignOut: () => void
  canConfigureGateway: boolean
  onConfigureGateway: () => void
  onOpenItem: (item: MediaItem) => void
}) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim())

  const homeQuery = useHome({ apiBaseUrl })
  // Read once per mount: HomeScreen only mounts after login, when lolarr.jellyfin is already persisted. If this screen ever survives a re-auth, switch to a subscribed read.
  const jellyfinSession = useMemo(() => readJellyfinSession(storage), [storage])

  const api = useApi()
  const searchQuery = useQuery({
    queryKey: ['search', apiBaseUrl, deferredQuery],
    queryFn: () => api.search(deferredQuery),
    enabled: Boolean(deferredQuery),
  })

  const { requests, requestsError } = useRequests({ apiBaseUrl, enabled: true })

  const rows =
    deferredQuery && searchQuery.data
      ? [
          {
            id: 'search-results',
            title: `Search results for "${deferredQuery}"`,
            items: searchQuery.data.results,
          },
        ]
      : (homeQuery.data?.rows ?? []).map((row) => ({
          ...row,
          items: enrichItems(row.items, jellyfinSession),
        }))
  const heroSource = homeQuery.data?.hero
  const featuredItem = heroSource
    ? { ...heroSource, ...resolveItemImages(heroSource, jellyfinSession) }
    : rows[0]?.items[0]
  const error = homeQuery.error ?? searchQuery.error ?? requestsError

  return (
    <AppFrame
      Action={Action}
      onConfigureGateway={canConfigureGateway ? onConfigureGateway : undefined}
      userName={userName}
      onSignOut={onSignOut}
    >
      {error ? <ErrorPanel message={readErrorMessage(error)} /> : null}
      <HeroPanel item={featuredItem} onOpen={onOpenItem} Action={Action} />
      <SearchBar TextInput={TextInput} query={query} onQueryChange={setQuery} />
      {homeQuery.isLoading || searchQuery.isLoading ? <LoadingPanel /> : null}
      {rows.map((row) => (
        <MediaRail
          key={row.id}
          id={row.id}
          title={row.title}
          items={row.items}
          onOpen={onOpenItem}
          Action={Action}
        />
      ))}
      <RequestList requests={requests} />
    </AppFrame>
  )
}
