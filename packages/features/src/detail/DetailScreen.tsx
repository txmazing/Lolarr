import { useQuery } from '@tanstack/react-query'
import type { MediaItem } from '@lolarr/domain'
import { AppFrame, DetailPanel, type ActionComponent } from '@lolarr/ui'
import { useApi } from '../api.js'
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

  const { createRequest, isRequesting } = useRequests({ apiBaseUrl, enabled: true })

  const detailItem = detailQuery.data?.item ?? selectedItem

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
        onBack={onBack}
        onRequest={createRequest}
        Action={Action}
      />
    </AppFrame>
  )
}
