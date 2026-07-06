import { useQuery } from '@tanstack/react-query'
import { useApi } from '../api.js'

export function useLibraryDetail({ apiBaseUrl, itemId }: { apiBaseUrl: string; itemId: string }) {
  const api = useApi()
  return useQuery({
    queryKey: ['library', apiBaseUrl, itemId],
    queryFn: () => api.libraryDetail(itemId),
  })
}
