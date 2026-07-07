// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JellyfinSession, MediaItem } from '@lolarr/domain'
import { resolveItemImages } from '../src/lib/images.js'

const session: JellyfinSession = {
  url: 'https://jf.example',
  accessToken: 't',
  userId: 'u',
  deviceId: 'd',
}

const item = {
  id: '1',
  title: 'X',
  mediaType: 'movie',
  availability: 'available',
  posterUrl: 'fallback-p.jpg',
  backdropUrl: 'fallback-b.jpg',
  jellyfin: {
    itemId: 'jf1',
    imageTags: { primary: 'tag-p', backdrop: 'tag-b' },
  },
} as unknown as MediaItem

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resolveItemImages', () => {
  it('requests the poster at card width on a 1x display (TV)', () => {
    vi.stubGlobal('devicePixelRatio', 1)
    const { posterUrl } = resolveItemImages(item, session)
    expect(posterUrl).toContain('fillWidth=240')
  })

  it('requests the poster at 2x card width on a retina display, capped at 2x', () => {
    vi.stubGlobal('devicePixelRatio', 3)
    const { posterUrl } = resolveItemImages(item, session)
    expect(posterUrl).toContain('fillWidth=480')
  })

  it('keeps the backdrop at 1280 (shared with the viewport-wide hero)', () => {
    vi.stubGlobal('devicePixelRatio', 1)
    const { backdropUrl } = resolveItemImages(item, session)
    expect(backdropUrl).toContain('fillWidth=1280')
  })

  it('passes through fallback urls without a session', () => {
    const { posterUrl, backdropUrl } = resolveItemImages(item, null)
    expect(posterUrl).toBe('fallback-p.jpg')
    expect(backdropUrl).toBe('fallback-b.jpg')
  })

  it('requests a larger poster when the item has no backdrop (landscape-card fallback)', () => {
    vi.stubGlobal('devicePixelRatio', 1)
    const noBackdrop = {
      ...item,
      jellyfin: { itemId: 'jf1', imageTags: { primary: 'tag-p' } },
    } as unknown as MediaItem
    const { posterUrl, backdropUrl } = resolveItemImages(noBackdrop, session)
    expect(posterUrl).toContain('fillWidth=400')
    expect(backdropUrl).toBe('fallback-b.jpg')
  })
})
