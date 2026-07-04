// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const show = vi.fn()
const notifications = vi.fn()
const markNotificationsRead = vi.fn().mockResolvedValue({ unreadCount: 0 })

vi.mock('../src/api.js', () => ({ useApi: () => ({ notifications, markNotificationsRead }) }))
vi.mock('../src/notifications/ToastProvider.js', () => ({ useToast: () => ({ show }) }))

import { NotificationsProvider, useNotificationsContext } from '../src/notifications/NotificationsProvider.js'

const AVAILABLE = { id: 'n1', kind: 'available', tmdbId: 1, mediaType: 'movie', title: 'A', createdAt: '2026-07-04T00:00:00Z', read: false }
const APPROVED = { id: 'n2', kind: 'approved', tmdbId: 2, mediaType: 'movie', title: 'B', createdAt: '2026-07-04T00:01:00Z', read: false }

function Consumer() {
  const { unreadCount, markRead } = useNotificationsContext()
  return (
    <div>
      <span>unread:{unreadCount}</span>
      <button onClick={markRead}>read</button>
    </div>
  )
}

function renderProvider(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationsProvider apiBaseUrl="http://api" enabled>
        <Consumer />
      </NotificationsProvider>
    </QueryClientProvider>,
  )
}

describe('NotificationsProvider', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('seeds the backlog without toasting, then toasts only new arrivals', async () => {
    notifications
      .mockResolvedValueOnce({ notifications: [AVAILABLE], unreadCount: 1 })
      .mockResolvedValue({ notifications: [APPROVED, AVAILABLE], unreadCount: 2 })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    renderProvider(queryClient)

    await screen.findByText('unread:1')
    expect(show).not.toHaveBeenCalled()

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
    })
    await screen.findByText('unread:2')
    expect(show).toHaveBeenCalledTimes(1)
    expect(show).toHaveBeenCalledWith({ kind: 'approved', title: 'B' })
  })

  it('marks read via the api', async () => {
    notifications.mockResolvedValue({ notifications: [], unreadCount: 0 })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    renderProvider(queryClient)
    await screen.findByText('unread:0')

    await act(async () => {
      fireEvent.click(screen.getByText('read'))
    })
    expect(markNotificationsRead).toHaveBeenCalledTimes(1)
  })
})
