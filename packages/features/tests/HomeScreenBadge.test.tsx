// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ActionComponent } from '@lolarr/ui'

vi.mock('../src/home/useHome.js', () => ({ useHome: () => ({ data: { rows: [] }, isLoading: false, error: null, refetch: vi.fn() }) }))
vi.mock('../src/requests/useRequests.js', () => ({ useRequests: () => ({ requests: [], requestsError: null }) }))
vi.mock('@lolarr/jellyfin', () => ({ readJellyfinSession: () => null }))

const unread = { value: 0 }
vi.mock('../src/notifications/NotificationsProvider.js', () => ({
  useNotificationsContext: () => ({ unreadCount: unread.value, markRead: vi.fn() }),
}))

import { HomeScreen } from '../src/home/HomeScreen.js'

const Action: ActionComponent = ({ onPress, children }) => <button onClick={onPress}>{children}</button>

const storage = { get: () => null, set: () => {}, remove: () => {} }

function renderHome() {
  render(
    <HomeScreen
      Action={Action}
      storage={storage}
      apiBaseUrl="http://api"
      userName="Joel"
      onSignOut={vi.fn()}
      canConfigureGateway={false}
      onConfigureGateway={vi.fn()}
      onOpenItem={vi.fn()}
      onPlayItem={vi.fn()}
      onOpenSearch={vi.fn()}
      onOpenRequests={vi.fn()}
    />,
  )
}

describe('HomeScreen notification badge', () => {
  afterEach(cleanup)

  it('hides the badge when there are no unread notifications', () => {
    unread.value = 0
    renderHome()
    expect(document.querySelector('.nav-badge')).toBeNull()
  })

  it('shows the unread count on the Requests entry', () => {
    unread.value = 3
    renderHome()
    expect(screen.getByText('3')).toBeDefined()
    expect(document.querySelector('.nav-badge')?.textContent).toBe('3')
  })
})
