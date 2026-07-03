import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { LoginRequest } from '@lolarr/domain'
import { useApi } from '../api.js'
import { readErrorMessage } from '../lib/errors.js'
import type { KeyValueStorage } from '../storage.js'

const tokenStorageKey = 'lolarr.session-token'

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
    mutationFn: (payload: LoginRequest) => api.login(payload),
    onMutate: () => {
      setLoginError(undefined)
    },
    onSuccess: (response) => {
      writeStoredToken(storage, response.token)
      setToken(response.token)
      queryClient.setQueryData(['session', apiBaseUrl, response.token], {
        user: response.user,
      })
    },
    onError: (error) => {
      setLoginError(readErrorMessage(error))
    },
  })

  function login(payload: LoginRequest) {
    loginMutation.mutate(payload)
  }

  function signOut() {
    writeStoredToken(storage, undefined)
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
