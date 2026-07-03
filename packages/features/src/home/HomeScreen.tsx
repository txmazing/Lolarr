import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import type { MediaItem } from '@lolarr/domain'
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
import { readErrorMessage } from '../lib/errors.js'
import { useRequests } from '../requests/useRequests.js'

export function HomeScreen({
  Action,
  TextInput,
  apiBaseUrl,
  userName,
  onSignOut,
  canConfigureGateway,
  onConfigureGateway,
  onOpenItem,
}: {
  Action: ActionComponent
  TextInput: TextInputComponent
  apiBaseUrl: string
  userName: string
  onSignOut: () => void
  canConfigureGateway: boolean
  onConfigureGateway: () => void
  onOpenItem: (item: MediaItem) => void
}) {
  const api = useApi()
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim())

  const discoverQuery = useQuery({
    queryKey: ['discover', apiBaseUrl],
    queryFn: () => api.discover(),
  })

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
      : discoverQuery.data?.rows ?? []
  const featuredItem = rows[0]?.items[0]
  const error = discoverQuery.error ?? searchQuery.error ?? requestsError

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
      {discoverQuery.isLoading || searchQuery.isLoading ? <LoadingPanel /> : null}
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
