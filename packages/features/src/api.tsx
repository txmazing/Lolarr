import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { createLolarrApiClient, type LolarrApiClient } from '@lolarr/api-client'

const ApiContext = createContext<LolarrApiClient | undefined>(undefined)

export function ApiProvider({
  baseUrl,
  token,
  onUnauthorized,
  children,
}: {
  baseUrl: string
  token: string | undefined
  onUnauthorized: () => void
  children: ReactNode
}) {
  const api = useMemo(
    () =>
      createLolarrApiClient({
        baseUrl,
        getToken: () => token,
        onUnauthorized,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mirrors original createLolarrApiClient memo deps (apiBaseUrl, token)
    [baseUrl, token],
  )

  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- co-located hook mirrors the Context/Provider it reads, per task-8 brief
export function useApi(): LolarrApiClient {
  const api = useContext(ApiContext)

  if (!api) {
    throw new Error('useApi must be used within an ApiProvider')
  }

  return api
}
