import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MediaItem } from '@lolarr/domain'
import { useApi } from '../api.js'

export function useRequests({ apiBaseUrl, enabled }: { apiBaseUrl: string; enabled: boolean }) {
  const queryClient = useQueryClient()
  const api = useApi()

  const requestsQuery = useQuery({
    queryKey: ['requests', apiBaseUrl],
    queryFn: () => api.requests(),
    enabled,
  })

  const requestMutation = useMutation({
    mutationFn: (item: MediaItem) => {
      if (item.tmdbId === undefined) {
        return Promise.reject(new Error('Cannot create a request for an item without a tmdbId'))
      }
      return api.createRequest({
        mediaType: item.mediaType,
        tmdbId: item.tmdbId,
        title: item.title,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['requests'] })
      void queryClient.invalidateQueries({ queryKey: ['discover'] })
      void queryClient.invalidateQueries({ queryKey: ['search'] })
      void queryClient.invalidateQueries({ queryKey: ['media'] })
    },
  })

  return {
    requests: requestsQuery.data?.requests ?? [],
    requestsError: requestsQuery.error,
    isRequestsLoading: requestsQuery.isLoading,
    createRequest: (item: MediaItem) => requestMutation.mutate(item),
    isRequesting: requestMutation.isPending,
  }
}
