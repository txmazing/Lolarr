import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import type { MediaItem } from '@lolarr/domain'
import {
  AppFrame,
  ErrorPanel,
  LoadingPanel,
  MediaPosterButton,
  SearchBar,
  type ActionComponent,
  type TextInputComponent,
} from '@lolarr/ui'
import { useApi } from '../api.js'
import { readErrorMessage } from '../lib/errors.js'

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
}) {
  const api = useApi()
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim())

  const searchQuery = useQuery({
    queryKey: ['search', apiBaseUrl, deferredQuery],
    queryFn: () => api.search(deferredQuery),
    enabled: deferredQuery.length >= 2,
  })

  const results = searchQuery.data?.results ?? []

  return (
    <AppFrame
      Action={Action}
      onConfigureGateway={canConfigureGateway ? onConfigureGateway : undefined}
      userName={userName}
      onSignOut={onSignOut}
    >
      <Action className="ghost-action" onPress={onBack} focusKey="search-back">
        Back
      </Action>
      <SearchBar TextInput={TextInput} query={query} onQueryChange={setQuery} />
      {searchQuery.error ? <ErrorPanel message={readErrorMessage(searchQuery.error)} /> : null}
      {searchQuery.isLoading ? <LoadingPanel /> : null}
      {deferredQuery.length < 2 ? (
        <p className="empty-state">Type at least two characters to search.</p>
      ) : !searchQuery.isLoading && !searchQuery.error && results.length === 0 ? (
        <p className="empty-state">No results for "{deferredQuery}".</p>
      ) : (
        <div className="search-grid">
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
