import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../src/server.js'
import { createTestContext, loginTestUser } from './helpers.js'

const JSON_HEADERS = { headers: { 'content-type': 'application/json' } }

function mockJellyfinHome(ctx: ReturnType<typeof createTestContext>) {
  ctx.jellyfin
    .intercept({ path: /\/UserItems\/Resume.*/, method: 'GET' })
    .reply(200, { Items: [{ Id: 'r1', Name: 'Resumed Movie', Type: 'Movie', UserData: { PlayedPercentage: 40 } }] }, JSON_HEADERS)
  ctx.jellyfin
    .intercept({ path: /\/Shows\/NextUp.*/, method: 'GET' })
    .reply(200, { Items: [{ Id: 'n1', Name: 'Next Episode', Type: 'Episode', SeriesName: 'Some Show', ParentIndexNumber: 2, IndexNumber: 3 }] }, JSON_HEADERS)
  ctx.jellyfin
    .intercept({ path: /\/UserViews.*/, method: 'GET' })
    .reply(200, { Items: [{ Id: 'lib1', Name: 'Movies', CollectionType: 'movies' }] }, JSON_HEADERS)
  ctx.jellyfin
    .intercept({ path: /\/Items\/Latest.*/, method: 'GET' })
    .reply(200, [{ Id: 'l1', Name: 'Fresh Movie', Type: 'Movie' }], JSON_HEADERS)
}

function mockSeerrDiscover(ctx: ReturnType<typeof createTestContext>) {
  ctx.seerr
    .intercept({ path: /\/api\/v1\/discover\/.*/, method: 'GET' })
    .reply(200, { results: [{ id: 550, mediaType: 'movie', title: 'Fight Club' }] }, JSON_HEADERS)
    .times(3)
}

describe('GET /api/home', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('returns library rows before discover rows with a resume hero', async () => {
    const app = createServer(ctx.config)
    const { token } = await loginTestUser(app, ctx)
    mockJellyfinHome(ctx)
    mockSeerrDiscover(ctx)

    const response = await app.inject({
      method: 'GET',
      url: '/api/home',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.hero.id).toBe('jf-r1')
    const rowIds = body.rows.map((row: { id: string }) => row.id)
    expect(rowIds[0]).toBe('continue-watching')
    expect(rowIds[1]).toBe('latest-lib1')
    expect(rowIds).toContain('trending')
    expect(rowIds.indexOf('latest-lib1')).toBeLessThan(rowIds.indexOf('trending'))
    // continue-watching = Resume + NextUp gemergt
    const cw = body.rows[0]
    expect(cw.items.map((i: { id: string }) => i.id)).toEqual(['jf-r1', 'jf-n1'])
  })

  it('falls back to a discover hero when nothing is in progress', async () => {
    const app = createServer(ctx.config)
    const { token } = await loginTestUser(app, ctx)
    ctx.jellyfin.intercept({ path: /\/UserItems\/Resume.*/, method: 'GET' }).reply(200, { Items: [] }, JSON_HEADERS)
    ctx.jellyfin.intercept({ path: /\/Shows\/NextUp.*/, method: 'GET' }).reply(200, { Items: [] }, JSON_HEADERS)
    ctx.jellyfin.intercept({ path: /\/UserViews.*/, method: 'GET' }).reply(200, { Items: [] }, JSON_HEADERS)
    mockSeerrDiscover(ctx)

    const response = await app.inject({ method: 'GET', url: '/api/home', headers: { authorization: `Bearer ${token}` } })
    const body = response.json()
    expect(body.hero.tmdbId).toBe(550)
    expect(body.hero.jellyfin).toBeUndefined()
  })

  it('degrades to discover-only when jellyfin is down', async () => {
    const app = createServer(ctx.config)
    const { token } = await loginTestUser(app, ctx)
    ctx.jellyfin.intercept({ path: /\/UserItems\/Resume.*/, method: 'GET' }).reply(500, {})
    ctx.jellyfin.intercept({ path: /\/Shows\/NextUp.*/, method: 'GET' }).reply(500, {})
    ctx.jellyfin.intercept({ path: /\/UserViews.*/, method: 'GET' }).reply(500, {})
    mockSeerrDiscover(ctx)

    const response = await app.inject({ method: 'GET', url: '/api/home', headers: { authorization: `Bearer ${token}` } })
    expect(response.statusCode).toBe(200)
    const rowIds = response.json().rows.map((row: { id: string }) => row.id)
    expect(rowIds).toEqual(['trending', 'popular-movies', 'popular-shows'])
  })

  it('degrades to jellyfin-only when seerr is down', async () => {
    const app = createServer(ctx.config)
    const { token } = await loginTestUser(app, ctx)
    mockJellyfinHome(ctx)
    ctx.seerr.intercept({ path: /\/api\/v1\/discover\/.*/, method: 'GET' }).reply(503, {}).times(3)

    const response = await app.inject({ method: 'GET', url: '/api/home', headers: { authorization: `Bearer ${token}` } })
    expect(response.statusCode).toBe(200)
    const rowIds = response.json().rows.map((row: { id: string }) => row.id)
    expect(rowIds).toEqual(['continue-watching', 'latest-lib1'])
  })

  it('dedupes continue watching by series id, not title', async () => {
    const app = createServer(ctx.config)
    const { token } = await loginTestUser(app, ctx)
    ctx.jellyfin
      .intercept({ path: /\/UserItems\/Resume.*/, method: 'GET' })
      .reply(200, {
        Items: [{ Id: 'r1', Name: 'Episode 1', Type: 'Episode', SeriesName: 'Some Show', SeriesId: 'show-1', ParentIndexNumber: 1, IndexNumber: 1 }],
      }, JSON_HEADERS)
    ctx.jellyfin
      .intercept({ path: /\/Shows\/NextUp.*/, method: 'GET' })
      .reply(200, {
        Items: [
          // same series as Resume → dropped; same display title but different series → kept
          { Id: 'n1', Name: 'Episode 2', Type: 'Episode', SeriesName: 'Some Show', SeriesId: 'show-1', ParentIndexNumber: 1, IndexNumber: 2 },
          { Id: 'n2', Name: 'Pilot', Type: 'Episode', SeriesName: 'Some Show', SeriesId: 'show-2', ParentIndexNumber: 1, IndexNumber: 1 },
        ],
      }, JSON_HEADERS)
    ctx.jellyfin.intercept({ path: /\/UserViews.*/, method: 'GET' }).reply(200, { Items: [] }, JSON_HEADERS)
    mockSeerrDiscover(ctx)

    const response = await app.inject({ method: 'GET', url: '/api/home', headers: { authorization: `Bearer ${token}` } })
    expect(response.statusCode).toBe(200)
    const cw = response.json().rows[0]
    expect(cw.id).toBe('continue-watching')
    expect(cw.items.map((i: { id: string }) => i.id)).toEqual(['jf-r1', 'jf-n2'])
  })

  it('strips progress from "New in …" tiles', async () => {
    const app = createServer(ctx.config)
    const { token } = await loginTestUser(app, ctx)
    ctx.jellyfin.intercept({ path: /\/UserItems\/Resume.*/, method: 'GET' }).reply(200, { Items: [] }, JSON_HEADERS)
    ctx.jellyfin.intercept({ path: /\/Shows\/NextUp.*/, method: 'GET' }).reply(200, { Items: [] }, JSON_HEADERS)
    ctx.jellyfin
      .intercept({ path: /\/UserViews.*/, method: 'GET' })
      .reply(200, { Items: [{ Id: 'lib1', Name: 'Movies', CollectionType: 'movies' }] }, JSON_HEADERS)
    ctx.jellyfin
      .intercept({ path: /\/Items\/Latest.*/, method: 'GET' })
      .reply(200, [{ Id: 'l1', Name: 'Half Watched Movie', Type: 'Movie', UserData: { PlayedPercentage: 65 } }], JSON_HEADERS)
    mockSeerrDiscover(ctx)

    const response = await app.inject({ method: 'GET', url: '/api/home', headers: { authorization: `Bearer ${token}` } })
    expect(response.statusCode).toBe(200)
    const latest = response.json().rows.find((row: { id: string }) => row.id === 'latest-lib1')
    expect(latest.items[0].jellyfin.progressPercent).toBeUndefined()
  })

  it('returns 502 when views resolve but no row can be produced and sources failed', async () => {
    const app = createServer(ctx.config)
    const { token } = await loginTestUser(app, ctx)
    ctx.jellyfin.intercept({ path: /\/UserItems\/Resume.*/, method: 'GET' }).reply(500, {})
    ctx.jellyfin.intercept({ path: /\/Shows\/NextUp.*/, method: 'GET' }).reply(500, {})
    ctx.jellyfin
      .intercept({ path: /\/UserViews.*/, method: 'GET' })
      .reply(200, { Items: [{ Id: 'lib1', Name: 'Movies', CollectionType: 'movies' }] }, JSON_HEADERS)
    ctx.jellyfin.intercept({ path: /\/Items\/Latest.*/, method: 'GET' }).reply(500, {})
    ctx.seerr.intercept({ path: /\/api\/v1\/discover\/.*/, method: 'GET' }).reply(503, {}).times(3)

    const response = await app.inject({ method: 'GET', url: '/api/home', headers: { authorization: `Bearer ${token}` } })
    expect(response.statusCode).toBe(502)
    expect(response.json().error).toBe('jellyfin_unreachable')
  })

  it('returns 502 when both sources are down', async () => {
    const app = createServer(ctx.config)
    const { token } = await loginTestUser(app, ctx)
    ctx.jellyfin.intercept({ path: /\/UserItems\/Resume.*/, method: 'GET' }).reply(500, {})
    ctx.jellyfin.intercept({ path: /\/Shows\/NextUp.*/, method: 'GET' }).reply(500, {})
    ctx.jellyfin.intercept({ path: /\/UserViews.*/, method: 'GET' }).reply(500, {})
    ctx.seerr.intercept({ path: /\/api\/v1\/discover\/.*/, method: 'GET' }).reply(503, {}).times(3)

    const response = await app.inject({ method: 'GET', url: '/api/home', headers: { authorization: `Bearer ${token}` } })
    expect(response.statusCode).toBe(502)
    expect(response.json().error).toBe('jellyfin_unreachable')
  })

  it('triggers the 401 cascade when the jellyfin token is rejected', async () => {
    const app = createServer(ctx.config)
    const { token } = await loginTestUser(app, ctx)
    ctx.jellyfin.intercept({ path: /\/UserItems\/Resume.*/, method: 'GET' }).reply(401, {})
    ctx.jellyfin.intercept({ path: /\/Shows\/NextUp.*/, method: 'GET' }).reply(401, {})
    ctx.jellyfin.intercept({ path: /\/UserViews.*/, method: 'GET' }).reply(401, {})
    mockSeerrDiscover(ctx)

    const response = await app.inject({ method: 'GET', url: '/api/home', headers: { authorization: `Bearer ${token}` } })
    expect(response.statusCode).toBe(401)
    expect(response.json().error).toBe('session_expired')

    const followUp = await app.inject({ method: 'GET', url: '/api/home', headers: { authorization: `Bearer ${token}` } })
    expect(followUp.statusCode).toBe(401)
  })
})
