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
})
