import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react'
import { useApi } from '../api.js'
import { useToast } from './ToastProvider.js'

const POLL_INTERVAL_MS = 45_000

type NotificationsContextValue = {
  unreadCount: number
  markRead: () => void
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined)

export function NotificationsProvider({
  apiBaseUrl,
  enabled,
  children,
}: {
  apiBaseUrl: string
  enabled: boolean
  children: ReactNode
}) {
  const api = useApi()
  const toast = useToast()
  const queryClient = useQueryClient()
  const seenIds = useRef<Set<string> | null>(null)

  const query = useQuery({
    queryKey: ['notifications', apiBaseUrl],
    queryFn: () => api.notifications(),
    enabled,
    refetchInterval: POLL_INTERVAL_MS,
  })

  const notifications = query.data?.notifications
  useEffect(() => {
    if (!notifications) {
      return
    }
    // First successful load seeds the seen-set without toasting the backlog;
    // only notifications that arrive after mount produce a toast.
    if (seenIds.current === null) {
      seenIds.current = new Set(notifications.map((item) => item.id))
      return
    }
    for (const item of notifications) {
      if (!seenIds.current.has(item.id)) {
        seenIds.current.add(item.id)
        if (!item.read) {
          toast.show({ kind: item.kind, title: item.title })
        }
      }
    }
  }, [notifications, toast])

  const markMutation = useMutation({
    mutationFn: () => api.markNotificationsRead(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  // markMutation.mutate is referentially stable across renders (TanStack Query),
  // so markRead is stable too — RequestsScreen can use it as an effect dependency.
  const mutate = markMutation.mutate
  const markRead = useCallback(() => {
    mutate()
  }, [mutate])

  const value: NotificationsContextValue = {
    unreadCount: query.data?.unreadCount ?? 0,
    markRead,
  }

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider, matches api.tsx
export function useNotificationsContext(): NotificationsContextValue {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error('useNotificationsContext must be used within a NotificationsProvider')
  }
  return context
}
