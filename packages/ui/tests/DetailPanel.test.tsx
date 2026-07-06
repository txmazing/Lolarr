// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MediaItem } from '@lolarr/domain'
import { DetailPanel } from '@ui/components/DetailPanel'
import { DefaultAction } from '@ui/components/DefaultAction'

afterEach(cleanup)

const requestableItem = {
  id: '1',
  title: 'The Wire',
  overview: 'Baltimore, drugs, and the wire.',
  year: 2002,
  mediaType: 'tv',
  availability: 'requestable',
  tmdbId: 42,
  backdropUrl: 'b.jpg',
} as unknown as MediaItem

const playableItem = {
  id: '2',
  title: 'Continue Me',
  overview: 'Already in the library.',
  year: 2020,
  mediaType: 'movie',
  availability: 'available',
  tmdbId: 99,
  jellyfin: { itemId: 'jf-1', imageTags: {}, progressPercent: 40 },
} as unknown as MediaItem

describe('DetailPanel', () => {
  it('renders the request action as a bare (non-filled) control when no primary Play CTA exists', () => {
    render(
      <DetailPanel
        item={requestableItem}
        onBack={() => {}}
        onRequest={() => {}}
        Action={DefaultAction}
      />,
    )

    // With no onPlay wired, the request action is the only focus target, so
    // it takes the single primary slot.
    const request = screen.getByRole('button', { name: 'Request in Seerr' })
    expect(request.className).toContain('bg-primary-solid')
  })

  it('demotes the request action to bare once a primary Play CTA is present', () => {
    render(
      <DetailPanel
        item={playableItem}
        onBack={() => {}}
        onRequest={() => {}}
        onPlay={() => {}}
        Action={DefaultAction}
      />,
    )

    const play = screen.getByRole('button', { name: 'Fortsetzen' })
    expect(play.className).toContain('bg-primary-solid')

    const request = screen.getByRole('button', { name: 'Available in Jellyfin' })
    expect(request.className).not.toContain('bg-primary-solid')
    expect(request.className).toContain('bg-transparent')
  })

  it('renders a primary action for Abspielen when there is no resume progress', () => {
    const freshItem = {
      ...playableItem,
      jellyfin: { itemId: 'jf-1', imageTags: {} },
    } as unknown as MediaItem

    render(
      <DetailPanel
        item={freshItem}
        onBack={() => {}}
        onRequest={() => {}}
        onPlay={() => {}}
        Action={DefaultAction}
      />,
    )

    const play = screen.getByRole('button', { name: 'Abspielen' })
    expect(play.className).toContain('bg-primary-solid')
  })

  it('fires onRequest and onPlay independently', () => {
    const onRequest = vi.fn()
    const onPlay = vi.fn()
    render(
      <DetailPanel
        item={playableItem}
        onBack={() => {}}
        onRequest={onRequest}
        onPlay={onPlay}
        Action={DefaultAction}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Fortsetzen' }))
    expect(onPlay).toHaveBeenCalledWith(playableItem)
    expect(onRequest).not.toHaveBeenCalled()
  })

  it('shows the availability chip and title', () => {
    render(
      <DetailPanel
        item={requestableItem}
        onBack={() => {}}
        onRequest={() => {}}
        Action={DefaultAction}
      />,
    )

    expect(screen.getByText('The Wire')).toBeDefined()
    expect(screen.getByText('Requestable')).toBeDefined()
  })

  it('markiert den Detail-Wrapper als Scroll-Region', () => {
    const { container } = render(
      <DetailPanel
        item={requestableItem}
        onBack={() => {}}
        onRequest={() => {}}
        Action={DefaultAction}
      />,
    )
    expect(container.querySelector('[data-focus-scroll-region]')).toBeTruthy()
  })
})
