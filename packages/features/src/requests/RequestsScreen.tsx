import { useEffect } from 'react'
import {
  AppFrame,
  ErrorPanel,
  LoadingPanel,
  RequestList,
  type ActionComponent,
  type NavItem,
} from '@lolarr/ui'
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
  onOpenHome,
  onOpenSearch,
}: {
  Action: ActionComponent
  apiBaseUrl: string
  userName: string
  onSignOut: () => void
  canConfigureGateway: boolean
  onConfigureGateway: () => void
  onBack: () => void
  onOpenHome?: () => void
  onOpenSearch?: () => void
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

  const { markRead, unreadCount } = useNotificationsContext()
  useEffect(() => {
    markRead()
  }, [markRead])

  const navItems: NavItem[] = [
    { key: 'home', label: 'Start', onPress: () => onOpenHome?.() },
    {
      key: 'requests',
      label: 'Anfragen',
      onPress: () => {},
      active: true,
      badge: unreadCount || undefined,
    },
  ]

  return (
    <AppFrame
      Action={Action}
      navItems={navItems}
      onConfigureGateway={canConfigureGateway ? onConfigureGateway : undefined}
      onOpenSearch={onOpenSearch}
      userName={userName}
      onSignOut={onSignOut}
    >
      <Action variant="ghost" onPress={onBack} focusKey="requests-back">
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
