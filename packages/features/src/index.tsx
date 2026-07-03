import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  useDeferredValue,
  useMemo,
  useState,
  type ComponentType,
  type FormEvent,
} from 'react'
import { createLolarrApiClient, LolarrApiError } from '@lolarr/api-client'
import type { LoginRequest, MediaItem } from '@lolarr/domain'
import {
  AppFrame,
  DefaultTextInput,
  DetailPanel,
  ErrorPanel,
  GatewayPanel,
  HeroPanel,
  LoadingPanel,
  LoginPanel,
  MediaRail,
  RequestList,
  SearchBar,
  type ActionComponent,
  type ShellProps,
  type TextInputComponent,
} from '@lolarr/ui'

const tokenStorageKey = 'lolarr.session-token'
const apiBaseUrlStorageKey = 'lolarr.api-base-url'
declare const __LOLARR_API_URL__: string
const compiledApiBaseUrl = __LOLARR_API_URL__

export type LolarrAppProps = {
  Action: ActionComponent
  TextInput?: TextInputComponent
  Shell?: ComponentType<ShellProps>
}

export function LolarrApp({
  Action,
  TextInput = DefaultTextInput,
  Shell = DefaultShell,
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
        <LolarrExperience Action={Action} TextInput={TextInput} />
      </Shell>
    </QueryClientProvider>
  )
}

function LolarrExperience({
  Action,
  TextInput,
}: {
  Action: ActionComponent
  TextInput: TextInputComponent
}) {
  const queryClient = useQueryClient()
  const [apiBaseUrl, setApiBaseUrl] = useState(readInitialApiBaseUrl)
  const [isGatewaySetupOpen, setIsGatewaySetupOpen] = useState(() =>
    shouldRequireGatewaySetup(readInitialApiBaseUrl()),
  )
  const [gatewayError, setGatewayError] = useState<string>()
  const [token, setToken] = useState(readStoredToken)
  const [loginError, setLoginError] = useState<string>()
  const [selectedItem, setSelectedItem] = useState<MediaItem>()
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim())

  const api = useMemo(
    () =>
      createLolarrApiClient({
        baseUrl: apiBaseUrl,
        getToken: () => token,
        onUnauthorized: () => {
          writeStoredToken(undefined)
          setToken(undefined)
        },
      }),
    [apiBaseUrl, token],
  )

  const sessionQuery = useQuery({
    queryKey: ['session', apiBaseUrl, token],
    queryFn: () => api.session(),
    enabled: Boolean(token),
  })

  const user = sessionQuery.data?.user

  const discoverQuery = useQuery({
    queryKey: ['discover', apiBaseUrl],
    queryFn: () => api.discover(),
    enabled: Boolean(user),
  })

  const requestsQuery = useQuery({
    queryKey: ['requests', apiBaseUrl],
    queryFn: () => api.requests(),
    enabled: Boolean(user),
  })

  const searchQuery = useQuery({
    queryKey: ['search', apiBaseUrl, deferredQuery],
    queryFn: () => api.search(deferredQuery),
    enabled: Boolean(user && deferredQuery),
  })

  const detailQuery = useQuery({
    queryKey: ['media', apiBaseUrl, selectedItem?.mediaType, selectedItem?.tmdbId],
    queryFn: () => api.media(selectedItem?.mediaType ?? 'movie', selectedItem?.tmdbId ?? 0),
    enabled: Boolean(user && selectedItem),
  })

  const loginMutation = useMutation({
    mutationFn: (payload: LoginRequest) => api.login(payload),
    onMutate: () => {
      setLoginError(undefined)
    },
    onSuccess: (response) => {
      writeStoredToken(response.token)
      setToken(response.token)
      queryClient.setQueryData(['session', apiBaseUrl, response.token], {
        user: response.user,
      })
    },
    onError: (error) => {
      setLoginError(readErrorMessage(error))
    },
  })

  const requestMutation = useMutation({
    mutationFn: (item: MediaItem) =>
      api.createRequest({
        mediaType: item.mediaType,
        tmdbId: item.tmdbId,
        title: item.title,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['requests'] })
      void queryClient.invalidateQueries({ queryKey: ['discover'] })
      void queryClient.invalidateQueries({ queryKey: ['search'] })
      void queryClient.invalidateQueries({ queryKey: ['media'] })
    },
  })

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const username = String(formData.get('username') ?? '')
    const password = String(formData.get('password') ?? '')
    loginMutation.mutate({ username, password })
  }

  function handleGatewaySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const nextApiBaseUrl = normalizeApiBaseUrl(String(formData.get('apiUrl') ?? ''))

    if (!nextApiBaseUrl) {
      setGatewayError('Use an absolute HTTP URL, for example http://192.168.1.50:4000.')
      return
    }

    setGatewayError(undefined)
    writeStoredApiBaseUrl(nextApiBaseUrl)
    writeStoredToken(undefined)
    setApiBaseUrl(nextApiBaseUrl)
    setToken(undefined)
    setSelectedItem(undefined)
    setIsGatewaySetupOpen(false)
    queryClient.clear()
  }

  function handleSignOut() {
    writeStoredToken(undefined)
    setToken(undefined)
    setSelectedItem(undefined)
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
      <AppFrame
        Action={Action}
        onConfigureGateway={canConfigureGateway ? handleConfigureGateway : undefined}
      >
        <form onSubmit={handleGatewaySubmit}>
          <GatewayPanel
            Action={Action}
            defaultUrl={apiBaseUrl}
            error={gatewayError}
            TextInput={TextInput}
          />
        </form>
      </AppFrame>
    )
  }

  if (token && sessionQuery.isLoading) {
    return (
      <AppFrame
        Action={Action}
        onConfigureGateway={canConfigureGateway ? handleConfigureGateway : undefined}
      >
        <LoadingPanel />
      </AppFrame>
    )
  }

  if (!user) {
    return (
      <AppFrame
        Action={Action}
        onConfigureGateway={canConfigureGateway ? handleConfigureGateway : undefined}
      >
        <form onSubmit={handleLogin}>
          <LoginPanel
            Action={Action}
            error={loginError}
            isLoading={loginMutation.isPending}
            TextInput={TextInput}
          />
        </form>
      </AppFrame>
    )
  }

  const detailItem = detailQuery.data?.item ?? selectedItem

  if (detailItem) {
    return (
      <AppFrame
        Action={Action}
        onConfigureGateway={canConfigureGateway ? handleConfigureGateway : undefined}
        userName={user.name}
        onSignOut={handleSignOut}
      >
        <DetailPanel
          item={detailItem}
          isRequesting={requestMutation.isPending}
          onBack={() => setSelectedItem(undefined)}
          onRequest={(item) => requestMutation.mutate(item)}
          Action={Action}
        />
      </AppFrame>
    )
  }

  const rows =
    deferredQuery && searchQuery.data
      ? [
          {
            id: 'search-results',
            title: `Search results for "${deferredQuery}"`,
            items: searchQuery.data.results,
          },
        ]
      : discoverQuery.data?.rows ?? []
  const featuredItem = rows[0]?.items[0]
  const error = discoverQuery.error ?? searchQuery.error ?? requestsQuery.error

  return (
    <AppFrame
      Action={Action}
      onConfigureGateway={canConfigureGateway ? handleConfigureGateway : undefined}
      userName={user.name}
      onSignOut={handleSignOut}
    >
      {error ? <ErrorPanel message={readErrorMessage(error)} /> : null}
      <HeroPanel item={featuredItem} onOpen={setSelectedItem} Action={Action} />
      <SearchBar TextInput={TextInput} query={query} onQueryChange={setQuery} />
      {discoverQuery.isLoading || searchQuery.isLoading ? <LoadingPanel /> : null}
      {rows.map((row) => (
        <MediaRail
          key={row.id}
          id={row.id}
          title={row.title}
          items={row.items}
          onOpen={setSelectedItem}
          Action={Action}
        />
      ))}
      <RequestList requests={requestsQuery.data?.requests ?? []} />
    </AppFrame>
  )
}

function DefaultShell({ children }: ShellProps) {
  return <>{children}</>
}

function readStoredToken() {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.localStorage.getItem(tokenStorageKey) ?? undefined
}

function readInitialApiBaseUrl() {
  return readStoredApiBaseUrl() ?? compiledApiBaseUrl
}

function readStoredApiBaseUrl() {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.localStorage.getItem(apiBaseUrlStorageKey) ?? undefined
}

function writeStoredApiBaseUrl(apiBaseUrl: string) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(apiBaseUrlStorageKey, apiBaseUrl)
}

function writeStoredToken(token: string | undefined) {
  if (typeof window === 'undefined') {
    return
  }

  if (token) {
    window.localStorage.setItem(tokenStorageKey, token)
  } else {
    window.localStorage.removeItem(tokenStorageKey)
  }
}

function readErrorMessage(error: unknown) {
  if (error instanceof LolarrApiError || error instanceof Error) {
    return error.message
  }

  return 'Unknown error'
}

function canUseRuntimeGatewayConfig() {
  return typeof window !== 'undefined'
}

function shouldRequireGatewaySetup(apiBaseUrl: string | undefined) {
  return !apiBaseUrl && isFileProtocol()
}

function isFileProtocol() {
  return typeof window !== 'undefined' && window.location.protocol === 'file:'
}

function normalizeApiBaseUrl(value: string) {
  const trimmedValue = value.trim().replace(/\/+$/, '')

  if (!trimmedValue) {
    return undefined
  }

  try {
    const url = new URL(trimmedValue)

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined
    }

    return url.toString().replace(/\/+$/, '')
  } catch {
    return undefined
  }
}
