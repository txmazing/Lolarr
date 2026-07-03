import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { LoginRequest, LoginResponse } from '@lolarr/domain'
import { useApi } from '../api.js'
import { readErrorMessage } from '../lib/errors.js'
import { getOrCreateDeviceId, type KeyValueStorage } from '../storage.js'

const tokenStorageKey = 'lolarr.session-token'
const jellyfinStorageKey = 'lolarr.jellyfin'

export function readStoredToken(storage: KeyValueStorage) {
  return storage.get(tokenStorageKey) ?? undefined
}

export function writeStoredToken(storage: KeyValueStorage, token: string | undefined) {
  if (token) {
    storage.set(tokenStorageKey, token)
  } else {
    storage.remove(tokenStorageKey)
  }
}

export function clearStoredSession(storage: KeyValueStorage) {
  storage.remove(tokenStorageKey)
  storage.remove(jellyfinStorageKey)
}

/**
 * Applies a successful login/quick-connect response: persists the token +
 * Jellyfin session to storage, updates the in-memory token, and seeds the
 * session query cache so the home screen doesn't refetch before rendering.
 * Shared by the password login mutation and the quick-connect poller so both
 * paths adopt a session identically.
 */
export function adoptSession(
  response: LoginResponse,
  {
    storage,
    apiBaseUrl,
    setToken,
    queryClient,
  }: {
    storage: KeyValueStorage
    apiBaseUrl: string
    setToken: (token: string | undefined) => void
    queryClient: QueryClient
  },
) {
  writeStoredToken(storage, response.token)
  storage.set(jellyfinStorageKey, JSON.stringify(response.jellyfin))
  setToken(response.token)
  queryClient.setQueryData(['session', apiBaseUrl, response.token], {
    user: response.user,
  })
}

/**
 * Auth state/mutations. Token itself is owned by the caller (LolarrExperience)
 * because the ApiProvider needs it before useAuth can run inside that provider's
 * subtree (getToken/onUnauthorized wiring). This hook consumes the current
 * token + setter and layers session/login/sign-out behaviour on top.
 */
export function useAuth({
  storage,
  apiBaseUrl,
  token,
  setToken,
}: {
  storage: KeyValueStorage
  apiBaseUrl: string
  token: string | undefined
  setToken: (token: string | undefined) => void
}) {
  const queryClient = useQueryClient()
  const api = useApi()
  const [loginError, setLoginError] = useState<string>()

  const sessionQuery = useQuery({
    queryKey: ['session', apiBaseUrl, token],
    queryFn: () => api.session(),
    enabled: Boolean(token),
  })

  const loginMutation = useMutation({
    mutationFn: (payload: Omit<LoginRequest, 'deviceId'>) =>
      api.login({ ...payload, deviceId: getOrCreateDeviceId(storage) }),
    onMutate: () => {
      setLoginError(undefined)
    },
    onSuccess: (response) => {
      adoptSession(response, { storage, apiBaseUrl, setToken, queryClient })
    },
    onError: (error) => {
      setLoginError(readErrorMessage(error))
    },
  })

  function login(payload: Omit<LoginRequest, 'deviceId'>) {
    loginMutation.mutate(payload)
  }

  function signOut() {
    clearStoredSession(storage)
    setToken(undefined)
    queryClient.clear()
  }

  return {
    user: sessionQuery.data?.user,
    isSessionLoading: Boolean(token) && sessionQuery.isLoading,
    login,
    isLoggingIn: loginMutation.isPending,
    loginError,
    signOut,
  }
}
