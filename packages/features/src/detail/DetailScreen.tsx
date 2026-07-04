import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { MediaItem } from '@lolarr/domain'
import { AppFrame, DetailPanel, SeasonRequestPicker, type ActionComponent } from '@lolarr/ui'
import { useApi } from '../api.js'
import { readErrorMessage } from '../lib/errors.js'
import { useRequests } from '../requests/useRequests.js'

export function DetailScreen({
  Action,
  apiBaseUrl,
  item: selectedItem,
  userName,
  onSignOut,
  canConfigureGateway,
  onConfigureGateway,
  onBack,
}: {
  Action: ActionComponent
  apiBaseUrl: string
  item: MediaItem
  userName: string
  onSignOut: () => void
  canConfigureGateway: boolean
  onConfigureGateway: () => void
  onBack: () => void
}) {
  const api = useApi()

  const tmdbId = selectedItem.tmdbId

  const detailQuery = useQuery({
    queryKey: ['media', apiBaseUrl, selectedItem.mediaType, tmdbId],
    queryFn: () => api.media(selectedItem.mediaType, tmdbId as number),
    enabled: tmdbId !== undefined,
  })

  const { createRequest, isRequesting, requestError, resetRequestError } = useRequests({
    apiBaseUrl,
    enabled: true,
  })
  const [showSeasonPicker, setShowSeasonPicker] = useState(false)

  const detailItem = detailQuery.data?.item ?? selectedItem
  const seasons = detailQuery.data?.seasons ?? []

  function handleRequest(item: MediaItem) {
    if (item.mediaType === 'tv' && seasons.length > 0) {
      setShowSeasonPicker(true)
      return
    }
    createRequest(item)
  }

  return (
    <AppFrame
      Action={Action}
      onConfigureGateway={canConfigureGateway ? onConfigureGateway : undefined}
      userName={userName}
      onSignOut={onSignOut}
    >
      <DetailPanel
        item={detailItem}
        isRequesting={isRequesting}
        requestError={
          !showSeasonPicker && requestError ? readErrorMessage(requestError) : undefined
        }
        onBack={onBack}
        onRequest={handleRequest}
        Action={Action}
      />
      {showSeasonPicker ? (
        <SeasonRequestPicker
          seasons={seasons}
          isRequesting={isRequesting}
          errorMessage={requestError ? readErrorMessage(requestError) : undefined}
          onConfirm={(selection) =>
            createRequest(detailItem, selection, { onSuccess: () => setShowSeasonPicker(false) })
          }
          onClose={() => {
            setShowSeasonPicker(false)
            // Drop a stale picker error so it does not resurface under the
            // main request button.
            resetRequestError()
          }}
          Action={Action}
        />
      ) : null}
    </AppFrame>
  )
}
