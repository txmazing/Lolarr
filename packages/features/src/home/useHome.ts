import { useQuery } from '@tanstack/react-query'
import { useApi } from '../api.js'

export function useHome({ apiBaseUrl }: { apiBaseUrl: string }) {
  const api = useApi()
  return useQuery({
    queryKey: ['home', apiBaseUrl],
    queryFn: () => api.home(),
  })
}
