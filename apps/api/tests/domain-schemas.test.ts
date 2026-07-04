import { describe, expect, it } from 'vitest'
import {
  createRequestSchema,
  homeResponseSchema,
  mediaDetailResponseSchema,
  mediaItemSchema,
  mediaRequestSchema,
  notificationSchema,
  notificationsResponseSchema,
  requestStatusSchema,
} from '@lolarr/domain'

describe('domain schemas (slice 2)', () => {
  it('accepts a jellyfin item without tmdbId', () => {
    const item = mediaItemSchema.parse({
      id: 'jf-abc',
      mediaType: 'movie',
      title: 'The Matrix',
      overview: '',
      availability: 'available',
      jellyfin: {
        itemId: 'abc',
        imageTags: { primary: 'tag1' },
        progressPercent: 42,
      },
    })
    expect(item.tmdbId).toBeUndefined()
    expect(item.jellyfin?.itemId).toBe('abc')
  })

  it('accepts a discover item without jellyfin field (backwards compatible)', () => {
    const item = mediaItemSchema.parse({
      id: 'movie-1',
      mediaType: 'movie',
      title: 'Dune',
      overview: '',
      tmdbId: 693134,
      availability: 'requestable',
    })
    expect(item.jellyfin).toBeUndefined()
  })

  it('parses a home response with optional hero', () => {
    expect(homeResponseSchema.parse({ rows: [] }).hero).toBeUndefined()
  })
})

describe('slice 4 request schemas', () => {
  it('accepts declined as request status', () => {
    expect(requestStatusSchema.parse('declined')).toBe('declined')
  })

  it('accepts a media request without title but with seasons and canCancel', () => {
    const parsed = mediaRequestSchema.parse({
      id: '10',
      mediaType: 'tv',
      tmdbId: 1399,
      status: 'pending',
      seasons: [1, 3],
      canCancel: true,
      requestedBy: { id: '1', name: 'Joel' },
      createdAt: '2026-07-04T10:00:00.000Z',
    })
    expect(parsed.title).toBeUndefined()
    expect(parsed.seasons).toEqual([1, 3])
  })

  it('rejects an empty seasons array on create', () => {
    expect(() =>
      createRequestSchema.parse({ mediaType: 'tv', tmdbId: 1399, title: 'GoT', seasons: [] }),
    ).toThrow()
  })

  it('accepts season availabilities on the media detail response', () => {
    const parsed = mediaDetailResponseSchema.parse({
      item: {
        id: 'tv-1399',
        mediaType: 'tv',
        title: 'Game of Thrones',
        overview: '',
        availability: 'partiallyAvailable',
      },
      seasons: [{ seasonNumber: 1, name: 'Season 1', availability: 'available' }],
    })
    expect(parsed.seasons?.[0]?.availability).toBe('available')
  })
})

describe('notification schemas', () => {
  it('parses a valid notification', () => {
    const parsed = notificationSchema.parse({
      id: 'n1',
      kind: 'available',
      tmdbId: 550,
      mediaType: 'movie',
      title: 'Fight Club',
      createdAt: '2026-07-04T10:00:00.000Z',
      read: false,
    })
    expect(parsed.kind).toBe('available')
  })

  it('rejects an unknown kind', () => {
    expect(() =>
      notificationSchema.parse({
        id: 'n1',
        kind: 'archived',
        tmdbId: 550,
        mediaType: 'movie',
        title: 'Fight Club',
        createdAt: '2026-07-04T10:00:00.000Z',
        read: false,
      }),
    ).toThrow()
  })

  it('parses a notifications response with an unread count', () => {
    const parsed = notificationsResponseSchema.parse({ notifications: [], unreadCount: 3 })
    expect(parsed.unreadCount).toBe(3)
  })
})
