import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../src/server.js'
import { createTestContext, loginTestUser } from './helpers.js'

const JSON_HEADERS = { headers: { 'content-type': 'application/json' } }

describe('GET /api/library/:itemId', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('returns a movie without seasons', async () => {
    const app = createServer(ctx.config)
    const { token } = await loginTestUser(app, ctx)
    ctx.jellyfin
      .intercept({ path: /\/Items\/movie-1\?.*/, method: 'GET' })
      .reply(200, { Id: 'movie-1', Name: 'The Matrix', Type: 'Movie', ProductionYear: 1999 }, JSON_HEADERS)

    const response = await app.inject({ method: 'GET', url: '/api/library/movie-1', headers: { authorization: `Bearer ${token}` } })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.item.id).toBe('jf-movie-1')
    expect(body.seasons).toBeUndefined()
  })

  it('returns a series with seasons and episodes incl. played state', async () => {
    const app = createServer(ctx.config)
    const { token } = await loginTestUser(app, ctx)
    ctx.jellyfin
      .intercept({ path: /\/Items\/series-1\?.*/, method: 'GET' })
      .reply(200, { Id: 'series-1', Name: 'Some Show', Type: 'Series' }, JSON_HEADERS)
    ctx.jellyfin
      .intercept({ path: /\/Shows\/series-1\/Seasons.*/, method: 'GET' })
      .reply(200, { Items: [{ Id: 's1', Name: 'Season 1' }] }, JSON_HEADERS)
    ctx.jellyfin
      .intercept({ path: /\/Shows\/series-1\/Episodes.*/, method: 'GET' })
      .reply(200, {
        Items: [{
          Id: 'e1', Name: 'Pilot', ParentIndexNumber: 1, IndexNumber: 1,
          RunTimeTicks: 36_000_000_000, UserData: { Played: true },
        }],
      }, JSON_HEADERS)

    const response = await app.inject({ method: 'GET', url: '/api/library/series-1', headers: { authorization: `Bearer ${token}` } })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.seasons).toHaveLength(1)
    expect(body.seasons[0].episodes[0]).toMatchObject({
      title: 'Pilot',
      seasonNumber: 1,
      episodeNumber: 1,
      runtimeMinutes: 60,
      played: true,
    })
  })

  it('triggers the 401 cascade when the jellyfin token is rejected', async () => {
    const app = createServer(ctx.config)
    const { token } = await loginTestUser(app, ctx)
    ctx.jellyfin
      .intercept({ path: /\/Items\/movie-1\?.*/, method: 'GET' })
      .reply(401, {})

    const response = await app.inject({ method: 'GET', url: '/api/library/movie-1', headers: { authorization: `Bearer ${token}` } })
    expect(response.statusCode).toBe(401)
    expect(response.json().error).toBe('session_expired')

    // The cascade deletes the session server-side: the follow-up fails without a Jellyfin call
    const followUp = await app.inject({ method: 'GET', url: '/api/library/movie-1', headers: { authorization: `Bearer ${token}` } })
    expect(followUp.statusCode).toBe(401)
  })

  it('returns 404 for unknown items', async () => {
    const app = createServer(ctx.config)
    const { token } = await loginTestUser(app, ctx)
    ctx.jellyfin
      .intercept({ path: /\/Items\/nope\?.*/, method: 'GET' })
      .reply(404, {})

    const response = await app.inject({ method: 'GET', url: '/api/library/nope', headers: { authorization: `Bearer ${token}` } })
    expect(response.statusCode).toBe(404)
    expect(response.json().error).toBe('Item not found')
  })
})
