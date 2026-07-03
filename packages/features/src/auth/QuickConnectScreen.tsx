import { useQuery } from '@tanstack/react-query'
import { QuickConnectPanel, type ActionComponent } from '@lolarr/ui'
import type { LoginResponse } from '@lolarr/domain'
import { useApi } from '../api.js'
import { readErrorMessage } from '../lib/errors.js'

type QuickConnectScreenProps = {
  Action: ActionComponent
  deviceId: string
  onAuthenticated: (response: LoginResponse) => void
  onCancel: () => void
}

export function QuickConnectScreen({
  Action,
  deviceId,
  onAuthenticated,
  onCancel,
}: QuickConnectScreenProps) {
  const api = useApi()

  const initiateQuery = useQuery({
    queryKey: ['qc-initiate', deviceId],
    queryFn: () => api.qcInitiate({ deviceId }),
    staleTime: Infinity,
    retry: false,
  })

  const pollToken = initiateQuery.data?.pollToken

  const pollQuery = useQuery({
    queryKey: ['qc-state', pollToken],
    enabled: Boolean(pollToken),
    refetchInterval: (query) => (query.state.status === 'error' ? false : 5000),
    retry: false,
    queryFn: async () => {
      const state = await api.qcState(pollToken as string)
      if (state.status === 'authenticated') {
        onAuthenticated(state)
      }
      return state
    },
  })

  const error = initiateQuery.error ?? pollQuery.error ? readErrorMessage(initiateQuery.error ?? pollQuery.error) : undefined

  return (
    <QuickConnectPanel
      Action={Action}
      code={initiateQuery.data?.code}
      error={error}
      onCancel={onCancel}
    />
  )
}
