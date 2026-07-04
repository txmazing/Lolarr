import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SeerrAdapter } from '../src/adapters/seerr.js'
import { SeerrSessionService } from '../src/services/seerrSession.js'
import { LolarrDatabase } from '../src/services/database.js'
import { createTestContext } from './helpers.js'

describe('SeerrAdapter discover cache', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('serves the second discover call from cache (single upstream round-trip)', async () => {
    // single-shot Intercepts: ein zweiter Upstream-Call würde mit
    // "no matching interceptor" fehlschlagen (disableNetConnect)
    for (const path of ['/api/v1/discover/trending', '/api/v1/discover/movies', '/api/v1/discover/tv']) {
      ctx.seerr
        .intercept({ path, method: 'GET' })
        .reply(200, { results: [{ id: 1, mediaType: 'movie', title: 'Dune' }] }, { headers: { 'content-type': 'application/json' } })
    }

    const database = new LolarrDatabase(ctx.config.LOLARR_DATABASE_PATH, ctx.config.LOLARR_SECRET)
    const seerr = new SeerrAdapter(ctx.config, new SeerrSessionService(ctx.config, database))

    const first = await seerr.discover()
    const second = await seerr.discover()
    expect(second).toEqual(first)
    expect(first.length).toBeGreaterThan(0)
  })

  it('busts the discover cache after a successful requestMedia so the next discover() hits upstream again', async () => {
    for (const path of ['/api/v1/discover/trending', '/api/v1/discover/movies', '/api/v1/discover/tv']) {
      ctx.seerr
        .intercept({ path, method: 'GET' })
        .reply(200, { results: [{ id: 1, mediaType: 'movie', title: 'Dune' }] }, { headers: { 'content-type': 'application/json' } })
    }

    const database = new LolarrDatabase(ctx.config.LOLARR_DATABASE_PATH, ctx.config.LOLARR_SECRET)
    const sessions = new SeerrSessionService(ctx.config, database)
    const seerr = new SeerrAdapter(ctx.config, sessions)

    const userId = 'jf-user-1'
    database.upsertUser({ id: userId, name: 'Joel' }, 'jellyfin-token')
    database.saveSeerrCookie(userId, 'connect.sid=s%3Auser')

    // Prime the cache: first discover() call hits upstream and caches the rows.
    const first = await seerr.discover()
    expect(first.length).toBeGreaterThan(0)

    // requestMedia() uses the cached cookie directly (no quick-connect needed) and must
    // invalidate the discover cache on success.
    ctx.seerr
      .intercept({ path: '/api/v1/request', method: 'POST' })
      .reply(
        201,
        { id: 42, status: 1, media: { mediaType: 'movie', tmdbId: 550, status: 2, title: 'Fight Club' } },
        { headers: { 'content-type': 'application/json' } },
      )

    await seerr.requestMedia(userId, { mediaType: 'movie', tmdbId: 550, title: 'Fight Club' })

    // Fresh single-shot intercepts with a different title: without the cache bust, discover()
    // would still be serving the stale cached rows and these intercepts would go unconsumed
    // (disableNetConnect would then fail any real upstream call, but the assertion on the
    // returned title is what actually proves the cache was invalidated).
    for (const path of ['/api/v1/discover/trending', '/api/v1/discover/movies', '/api/v1/discover/tv']) {
      ctx.seerr
        .intercept({ path, method: 'GET' })
        .reply(200, { results: [{ id: 2, mediaType: 'movie', title: 'Arrival' }] }, { headers: { 'content-type': 'application/json' } })
    }

    const second = await seerr.discover()
    expect(second).not.toEqual(first)
    expect(second[0]?.items[0]?.title).toBe('Arrival')
  })
})
