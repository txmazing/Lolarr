// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { MediaItem } from '@lolarr/domain'
import { MediaPosterButton } from '@ui/components/MediaPosterButton'
import { DefaultAction } from '@ui/components/DefaultAction'

afterEach(cleanup)

const item = {
  id: '1',
  title: 'X',
  posterUrl: 'p.jpg',
  backdropUrl: 'b.jpg',
  mediaType: 'movie',
  availability: 'available',
} as unknown as MediaItem

describe('MediaPosterButton', () => {
  it('renders a portrait card slot holding a single focus target', () => {
    const { container } = render(
      <MediaPosterButton item={item} onOpen={() => {}} Action={DefaultAction} focusKeyPrefix="row" />,
    )
    expect(container.querySelector('.lolarr-card-slot')).toBeTruthy()
    expect(container.querySelector('.lolarr-card')).toBeTruthy()
    // The whole card is the only focus target — no nested buttons.
    expect(container.querySelectorAll('button').length).toBe(1)
  })

  it('puts the title and meta in the expand overlay, not a caption', () => {
    const withYear = { ...item, title: 'Solo', year: 1999 } as unknown as MediaItem
    const { container } = render(
      <MediaPosterButton item={withYear} onOpen={() => {}} Action={DefaultAction} focusKeyPrefix="row" />,
    )
    const overlay = container.querySelector('.lolarr-overlay')
    expect(overlay?.textContent).toContain('Solo')
    expect(overlay?.textContent).toContain('1999')
  })

  it('renders the availability indicator as a non-interactive LED span', () => {
    const overlayItem = { ...item, availability: 'requestable' } as unknown as MediaItem
    const { container } = render(
      <MediaPosterButton item={overlayItem} onOpen={() => {}} Action={DefaultAction} focusKeyPrefix="row" />,
    )
    const overlay = container.querySelector('[aria-label="Requestable"]')
    expect(overlay).toBeTruthy()
    expect(overlay?.tagName).toBe('SPAN')
    expect(container.querySelectorAll('button').length).toBe(1)
  })

  it('decodes card images off the main thread', () => {
    const { container } = render(
      <MediaPosterButton item={item} onOpen={() => {}} Action={DefaultAction} focusKeyPrefix="row" />,
    )
    const imgs = Array.from(container.querySelectorAll('img'))
    expect(imgs.length).toBeGreaterThan(0)
    for (const img of imgs) {
      expect(img.getAttribute('decoding')).toBe('async')
    }
  })
})
