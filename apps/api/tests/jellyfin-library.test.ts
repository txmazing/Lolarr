import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  getResumeItems,
  mapJellyfinItem,
  type JellyfinUserAuth,
} from '../src/adapters/jellyfinLibrary.js'
import { JellyfinTokenInvalidError } from '../src/lib/errors.js'
import { createTestContext } from './helpers.js'

const auth: JellyfinUserAuth = {
  accessToken: 'user-token',
  userId: 'jf-user-1',
  deviceId: 'lolarr-gateway',
}

describe('mapJellyfinItem', () => {
  it('maps a movie with tmdb provider id and progress', () => {
    const item = mapJellyfinItem({
      Id: 'abc',
      Name: 'The Matrix',
      Type: 'Movie',
      ProductionYear: 1999,
      Overview: 'Simulation.',
      ImageTags: { Primary: 'p1', Thumb: 't1' },
      BackdropImageTags: ['b1'],
      ProviderIds: { Tmdb: '603' },
      UserData: { PlayedPercentage: 42.5 },
    })
    expect(item).toMatchObject({
      id: 'jf-abc',
      mediaType: 'movie',
      title: 'The Matrix',
      year: 1999,
      tmdbId: 603,
      availability: 'available',
      jellyfin: {
        itemId: 'abc',
        imageTags: { primary: 'p1', backdrop: 'b1', thumb: 't1' },
        progressPercent: 42.5,
      },
    })
  })

  it('maps an episode with series context and no tmdb id', () => {
    const item = mapJellyfinItem({
      Id: 'ep1',
      Name: 'The Pointy End',
      Type: 'Episode',
      SeriesName: 'Game of Thrones',
      ParentIndexNumber: 1,
      IndexNumber: 8,
      ImageTags: { Primary: 'still1' },
    })
    expect(item.title).toBe('Game of Thrones')
    expect(item.mediaType).toBe('tv')
    expect(item.tmdbId).toBeUndefined()
    expect(item.jellyfin?.episode).toEqual({
      seriesTitle: 'Game of Thrones',
      season: 1,
      number: 8,
    })
  })

  it('maps resume position and series id', () => {
    const item = mapJellyfinItem({
      Id: 'ep2',
      Name: 'Episode',
      Type: 'Episode',
      SeriesName: 'Show',
      SeriesId: 'series-9',
      ParentIndexNumber: 1,
      IndexNumber: 2,
      UserData: { PlaybackPositionTicks: 9_000_000_000, PlayedPercentage: 25 },
    })
    expect(item.jellyfin?.resumePositionTicks).toBe(9_000_000_000)
    expect(item.jellyfin?.seriesId).toBe('series-9')
  })
})

describe('getResumeItems', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('fetches and maps resume items with the user token', async () => {
    let seenAuth = ''
    ctx.jellyfin
      .intercept({
        path: /\/UserItems\/Resume.*/,
        method: 'GET',
        headers: (headers) => {
          seenAuth = headers.authorization ?? ''
          return true
        },
      })
      .reply(
        200,
        { Items: [{ Id: 'r1', Name: 'Movie', Type: 'Movie' }] },
        { headers: { 'content-type': 'application/json' } },
      )

    const items = await getResumeItems(ctx.config, auth, 12)
    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe('jf-r1')
    expect(seenAuth).toContain('Token="user-token"')
  })

  it('maps 401 to JellyfinTokenInvalidError with the user id', async () => {
    ctx.jellyfin
      .intercept({ path: /\/UserItems\/Resume.*/, method: 'GET' })
      .reply(401, {})
      .times(2)
    await expect(getResumeItems(ctx.config, auth, 12)).rejects.toMatchObject({
      name: 'JellyfinTokenInvalidError',
      userId: 'jf-user-1',
    })
    await expect(getResumeItems(ctx.config, auth, 12)).rejects.toBeInstanceOf(
      JellyfinTokenInvalidError,
    )
  })
})
