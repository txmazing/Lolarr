import { describe, expect, it } from 'vitest'
import {
  mapSeasonAvailabilities,
  mapSeerrRequest,
  mapSeerrRequestStatus,
} from '../src/adapters/seerr.js'

describe('mapSeerrRequestStatus', () => {
  it.each([
    [1, 5, 'pending'],
    [3, 5, 'declined'],
    [4, 1, 'failed'],
    [2, 5, 'available'],
    [2, 3, 'processing'],
    [2, 4, 'processing'],
    [2, 1, 'approved'],
    [2, undefined, 'approved'],
    [undefined, undefined, 'pending'],
  ])('maps request status %s with media status %s to %s', (requestStatus, mediaStatus, expected) => {
    expect(mapSeerrRequestStatus(requestStatus, mediaStatus)).toBe(expected)
  })
})

describe('mapSeerrRequest', () => {
  const base = {
    id: 10,
    status: 1,
    createdAt: '2026-07-04T10:00:00.000Z',
    media: { mediaType: 'tv', tmdbId: 1399, status: 2, title: 'Game of Thrones' },
    requestedBy: { id: 1, displayName: 'Joel' },
    seasons: [{ seasonNumber: 1 }, { seasonNumber: 3 }],
  }

  it('maps a pending tv request with seasons and cancel flag', () => {
    expect(mapSeerrRequest(base)).toEqual({
      id: '10',
      mediaType: 'tv',
      tmdbId: 1399,
      title: 'Game of Thrones',
      status: 'pending',
      seasons: [1, 3],
      canCancel: true,
      requestedBy: { id: '1', name: 'Joel' },
      createdAt: '2026-07-04T10:00:00.000Z',
    })
  })

  it('marks available requests as not cancelable and omits empty seasons', () => {
    const mapped = mapSeerrRequest({
      ...base,
      status: 2,
      media: { mediaType: 'movie', tmdbId: 550, status: 5 },
      seasons: [],
    })
    expect(mapped?.status).toBe('available')
    expect(mapped?.canCancel).toBe(false)
    expect(mapped?.seasons).toBeUndefined()
    expect(mapped?.title).toBeUndefined()
  })

  it('returns undefined without a media tmdb id', () => {
    expect(mapSeerrRequest({ id: 1, status: 1, media: { mediaType: 'movie' } })).toBeUndefined()
  })
})

describe('mapSeasonAvailabilities', () => {
  it('joins season list with per-season status and skips specials', () => {
    const seasons = mapSeasonAvailabilities({
      seasons: [
        { seasonNumber: 0, name: 'Specials' },
        { seasonNumber: 1, name: 'Season 1' },
        { seasonNumber: 2, name: 'Season 2' },
        { seasonNumber: 3, name: 'Season 3' },
      ],
      mediaInfo: {
        seasons: [
          { seasonNumber: 1, status: 5 },
          { seasonNumber: 2, status: 2 },
        ],
      },
    })
    expect(seasons).toEqual([
      { seasonNumber: 1, name: 'Season 1', availability: 'available' },
      { seasonNumber: 2, name: 'Season 2', availability: 'requested' },
      { seasonNumber: 3, name: 'Season 3', availability: 'requestable' },
    ])
  })

  it('returns an empty list without seasons', () => {
    expect(mapSeasonAvailabilities({})).toEqual([])
    expect(mapSeasonAvailabilities(undefined)).toEqual([])
  })
})
