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

  function invalidateAfterChange() {
    void queryClient.invalidateQueries({ queryKey: ['requests'] })
    void queryClient.invalidateQueries({ queryKey: ['home'] })
    void queryClient.invalidateQueries({ queryKey: ['search'] })
    void queryClient.invalidateQueries({ queryKey: ['media'] })
  }

  const requestMutation = useMutation({
    mutationFn: ({ item, seasons }: { item: MediaItem; seasons?: number[] }) => {
      if (item.tmdbId === undefined) {
        return Promise.reject(new Error('Cannot create a request for an item without a tmdbId'))
      }
      return api.createRequest({
        mediaType: item.mediaType,
        tmdbId: item.tmdbId,
        title: item.title,
        seasons,
      })
    },
    onSuccess: invalidateAfterChange,
  })

  const cancelMutation = useMutation({
    mutationFn: (requestId: string) => api.deleteRequest(requestId),
    onSettled: invalidateAfterChange,
  })

  return {
    requests: requestsQuery.data?.requests ?? [],
    requestsError: requestsQuery.error,
    isRequestsLoading: requestsQuery.isLoading,
    createRequest: (item: MediaItem, seasons?: number[], options?: { onSuccess?: () => void }) =>
      requestMutation.mutate({ item, seasons }, { onSuccess: options?.onSuccess }),
    isRequesting: requestMutation.isPending,
    requestError: requestMutation.error,
    cancelRequest: (requestId: string) => cancelMutation.mutate(requestId),
    cancelingId: cancelMutation.isPending ? cancelMutation.variables : undefined,
    cancelError:
      cancelMutation.error && cancelMutation.variables !== undefined
        ? { id: cancelMutation.variables, message: cancelMutation.error.message }
        : undefined,
  }
}
