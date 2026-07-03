import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { useState, type ComponentType } from 'react'
import {
  DefaultTextInput,
  type ActionComponent,
  type ShellProps,
  type TextInputComponent,
} from '@lolarr/ui'
import { ApiProvider } from './api.js'
import {
  canUseRuntimeGatewayConfig,
  isFileProtocol,
  normalizeApiBaseUrl,
  readInitialApiBaseUrl,
  shouldRequireGatewaySetup,
  writeStoredApiBaseUrl,
} from './auth/gateway.js'
import { GatewayScreen } from './auth/GatewayScreen.js'
import { clearStoredSession, readStoredToken } from './auth/useAuth.js'
import { AuthenticatedExperience } from './experience.js'
import { useScreenStore } from './navigation/store.js'
import { localStorageAdapter, type KeyValueStorage } from './storage.js'

declare const __LOLARR_API_URL__: string
const compiledApiBaseUrl = __LOLARR_API_URL__

export type LolarrAppProps = {
  Action: ActionComponent
  TextInput?: TextInputComponent
  Shell?: ComponentType<ShellProps>
  storage?: KeyValueStorage
}

export function LolarrApp({
  Action,
  TextInput = DefaultTextInput,
  Shell = DefaultShell,
  storage = localStorageAdapter,
}: LolarrAppProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 30_000,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <Shell>
        <LolarrExperience Action={Action} TextInput={TextInput} storage={storage} />
      </Shell>
    </QueryClientProvider>
  )
}

function LolarrExperience({
  Action,
  TextInput,
  storage,
}: {
  Action: ActionComponent
  TextInput: TextInputComponent
  storage: KeyValueStorage
}) {
  const queryClient = useQueryClient()
  const [apiBaseUrl, setApiBaseUrl] = useState(() =>
    readInitialApiBaseUrl(storage, compiledApiBaseUrl),
  )
  const [isGatewaySetupOpen, setIsGatewaySetupOpen] = useState(() =>
    shouldRequireGatewaySetup(readInitialApiBaseUrl(storage, compiledApiBaseUrl)),
  )
  const [gatewayError, setGatewayError] = useState<string>()
  const [token, setToken] = useState(() => readStoredToken(storage))

  function handleGatewaySubmit(nextRawApiBaseUrl: string) {
    const nextApiBaseUrl = normalizeApiBaseUrl(nextRawApiBaseUrl)

    if (!nextApiBaseUrl) {
      setGatewayError('Use an absolute HTTP URL, for example http://192.168.1.50:4000.')
      return
    }

    setGatewayError(undefined)
    writeStoredApiBaseUrl(storage, nextApiBaseUrl)
    clearStoredSession(storage)
    setApiBaseUrl(nextApiBaseUrl)
    setToken(undefined)
    useScreenStore.getState().reset()
    setIsGatewaySetupOpen(false)
    queryClient.clear()
  }

  function handleConfigureGateway() {
    setGatewayError(undefined)
    setIsGatewaySetupOpen(true)
  }

  const canConfigureGateway =
    canUseRuntimeGatewayConfig() &&
    (isFileProtocol() || Boolean(apiBaseUrl && apiBaseUrl !== compiledApiBaseUrl))

  if (isGatewaySetupOpen || shouldRequireGatewaySetup(apiBaseUrl)) {
    return (
      <GatewayScreen
        Action={Action}
        TextInput={TextInput}
        apiBaseUrl={apiBaseUrl}
        error={gatewayError}
        onSubmit={handleGatewaySubmit}
        canConfigureGateway={canConfigureGateway}
        onConfigureGateway={handleConfigureGateway}
      />
    )
  }

  return (
    <ApiProvider
      baseUrl={apiBaseUrl}
      token={token}
      onUnauthorized={() => {
        clearStoredSession(storage)
        setToken(undefined)
      }}
    >
      <AuthenticatedExperience
        Action={Action}
        TextInput={TextInput}
        storage={storage}
        apiBaseUrl={apiBaseUrl}
        token={token}
        setToken={setToken}
        canConfigureGateway={canConfigureGateway}
        onConfigureGateway={handleConfigureGateway}
      />
    </ApiProvider>
  )
}

function DefaultShell({ children }: ShellProps) {
  return <>{children}</>
}
