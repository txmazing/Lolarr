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
  it('defaults to portrait aspect', () => {
    const { container } = render(
      <MediaPosterButton item={item} onOpen={() => {}} Action={DefaultAction} focusKeyPrefix="row" />,
    )
    expect(container.querySelector('.aspect-\\[2\\/3\\]')).toBeTruthy()
    expect(container.querySelector('.aspect-video')).toBeFalsy()
  })

  it('supports landscape and has no nested buttons', () => {
    const { container } = render(
      <MediaPosterButton
        item={item}
        onOpen={() => {}}
        Action={DefaultAction}
        focusKeyPrefix="row"
        orientation="landscape"
      />,
    )
    expect(container.querySelector('.aspect-video')).toBeTruthy()
    expect(container.querySelectorAll('button').length).toBe(1) // the card itself only
  })

  it('renders the availability overlay as a non-interactive span', () => {
    const overlayItem = { ...item, availability: 'requestable' } as unknown as MediaItem
    const { container } = render(
      <MediaPosterButton item={overlayItem} onOpen={() => {}} Action={DefaultAction} focusKeyPrefix="row" />,
    )
    const overlay = container.querySelector('.glass-controls')
    expect(overlay).toBeTruthy()
    expect(overlay?.tagName).toBe('SPAN')
    expect(container.querySelectorAll('button').length).toBe(1)
  })
})
