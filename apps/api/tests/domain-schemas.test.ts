import { describe, expect, it } from 'vitest'
import { homeResponseSchema, mediaItemSchema } from '@lolarr/domain'

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
