import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import type { MediaItem } from '@lolarr/domain'
import {
  AppFrame,
  ErrorPanel,
  LoadingPanel,
  MediaPosterButton,
  SearchBar,
  type ActionComponent,
  type NavItem,
  type TextInputComponent,
} from '@lolarr/ui'
import { useApi } from '../api.js'
import { readErrorMessage } from '../lib/errors.js'
import { useNotificationsContext } from '../notifications/NotificationsProvider.js'

export function SearchScreen({
  Action,
  TextInput,
  apiBaseUrl,
  userName,
  onSignOut,
  canConfigureGateway,
  onConfigureGateway,
  onBack,
  onOpenItem,
  onOpenHome,
  onOpenRequests,
}: {
  Action: ActionComponent
  TextInput: TextInputComponent
  apiBaseUrl: string
  userName: string
  onSignOut: () => void
  canConfigureGateway: boolean
  onConfigureGateway: () => void
  onBack: () => void
  onOpenItem: (item: MediaItem) => void
  onOpenHome?: () => void
  onOpenRequests?: () => void
}) {
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
  const api = useApi()
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim())

  const searchQuery = useQuery({
    queryKey: ['search', apiBaseUrl, deferredQuery],
    queryFn: () => api.search(deferredQuery),
    enabled: deferredQuery.length >= 2,
    // Keep the previous results mounted while typing so the focused poster
    // does not unmount mid-navigation on TV.
    placeholderData: keepPreviousData,
  })

  const results = searchQuery.data?.results ?? []

  return (
    <AppFrame
      Action={Action}
      navItems={navItems}
      onConfigureGateway={canConfigureGateway ? onConfigureGateway : undefined}
      userName={userName}
      onSignOut={onSignOut}
    >
      <Action variant="secondary" onPress={onBack} focusKey="search-back">
        Back
      </Action>
      <SearchBar TextInput={TextInput} query={query} onQueryChange={setQuery} />
      {searchQuery.error ? (
        <ErrorPanel
          message={readErrorMessage(searchQuery.error)}
          Action={Action}
          onRetry={() => void searchQuery.refetch()}
        />
      ) : null}
      {searchQuery.isLoading ? <LoadingPanel /> : null}
      {deferredQuery.length < 2 ? (
        <p className="flex min-h-[52px] items-center justify-between gap-3.5 rounded-md bg-surface px-3.5 py-3 text-muted-foreground">Type at least two characters to search.</p>
      ) : !searchQuery.isLoading && !searchQuery.error && results.length === 0 ? (
        <p className="flex min-h-[52px] items-center justify-between gap-3.5 rounded-md bg-surface px-3.5 py-3 text-muted-foreground">No results for "{deferredQuery}".</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
          {results.map((item) => (
            <MediaPosterButton
              key={item.id}
              item={item}
              onOpen={onOpenItem}
              Action={Action}
              focusKeyPrefix="search"
            />
          ))}
        </div>
      )}
    </AppFrame>
  )
}
