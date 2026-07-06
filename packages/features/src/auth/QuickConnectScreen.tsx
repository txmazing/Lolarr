import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { QuickConnectPanel, type ActionComponent } from '@lolarr/ui'
import type { LoginResponse } from '@lolarr/domain'
import { useApi } from '../api.js'
import { readErrorMessage } from '../lib/errors.js'
import { generateUuid } from '../storage.js'

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
  const alreadyHandledRef = useRef(false)

  // Per-mount nonce: without it, `['qc-initiate', deviceId]` with staleTime:
  // Infinity would survive a cancel + re-open of this screen and hand back a
  // cached pollToken whose Quick Connect code has already expired server-side.
  const [mountNonce] = useState(() => generateUuid())

  const initiateQuery = useQuery({
    queryKey: ['qc-initiate', deviceId, mountNonce],
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
    queryFn: () => api.qcState(pollToken as string),
  })

  useEffect(() => {
    if (pollQuery.data?.status === 'authenticated' && !alreadyHandledRef.current) {
      alreadyHandledRef.current = true
      onAuthenticated(pollQuery.data)
    }
  }, [pollQuery.data, onAuthenticated])

  const combinedError = initiateQuery.error ?? pollQuery.error
  const error = combinedError ? readErrorMessage(combinedError) : undefined

  return (
    <QuickConnectPanel
      Action={Action}
      code={initiateQuery.data?.code}
      error={error}
      onCancel={onCancel}
    />
  )
}
