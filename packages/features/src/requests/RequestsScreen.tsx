import { useEffect } from 'react'
import { AppFrame, ErrorPanel, LoadingPanel, RequestList, type ActionComponent } from '@lolarr/ui'
import { readErrorMessage } from '../lib/errors.js'
import { useNotificationsContext } from '../notifications/NotificationsProvider.js'
import { useRequests } from './useRequests.js'

export function RequestsScreen({
  Action,
  apiBaseUrl,
  userName,
  onSignOut,
  canConfigureGateway,
  onConfigureGateway,
  onBack,
}: {
  Action: ActionComponent
  apiBaseUrl: string
  userName: string
  onSignOut: () => void
  canConfigureGateway: boolean
  onConfigureGateway: () => void
  onBack: () => void
}) {
  const {
    requests,
    requestsError,
    isRequestsLoading,
    refetchRequests,
    cancelRequest,
    cancelingId,
    cancelError,
  } = useRequests({ apiBaseUrl, enabled: true })

  const { markRead } = useNotificationsContext()
  useEffect(() => {
    markRead()
  }, [markRead])

  return (
    <AppFrame
      Action={Action}
      onConfigureGateway={canConfigureGateway ? onConfigureGateway : undefined}
      userName={userName}
      onSignOut={onSignOut}
    >
      <Action className="ghost-action" onPress={onBack} focusKey="requests-back">
        Back
      </Action>
      {requestsError ? (
        <ErrorPanel
          message={readErrorMessage(requestsError)}
          Action={Action}
          onRetry={refetchRequests}
        />
      ) : null}
      {isRequestsLoading ? <LoadingPanel /> : null}
      {!requestsError && !isRequestsLoading ? (
        <RequestList
          requests={requests}
          Action={Action}
          onCancel={(request) => cancelRequest(request.id)}
          cancelingId={cancelingId}
          cancelError={cancelError}
        />
      ) : null}
    </AppFrame>
  )
}
