import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createServer } from '../src/server.js'
import { createTestContext, jellyfinAuthResponse } from './helpers.js'

function seerrRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    status: 1,
    createdAt: '2026-07-04T10:00:00.000Z',
    media: { mediaType: 'movie', tmdbId: 550, status: 1, title: 'Fight Club' },
    requestedBy: { id: 1, displayName: 'Joel' },
    seasons: [],
    ...overrides,
  }
}

async function loginWithSeerrSession(app: FastifyInstance, ctx: ReturnType<typeof createTestContext>) {
  ctx.jellyfin
    .intercept({ path: '/Users/AuthenticateByName', method: 'POST' })
    .reply(200, jellyfinAuthResponse(), { headers: { 'content-type': 'application/json' } })
  ctx.seerr
    .intercept({ path: '/api/v1/auth/jellyfin', method: 'POST' })
    .reply(200, { id: 1 }, { headers: { 'set-cookie': 'connect.sid=s%3Auser; Path=/' } })

  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'joel', password: 'pw', deviceId: 'device-abc' },
  })
  return (login.json() as { token: string }).token
}

function interceptRequestList(ctx: ReturnType<typeof createTestContext>, results: unknown[]) {
  ctx.seerr
    .intercept({ path: '/api/v1/request', method: 'GET', query: { take: '50', sort: 'added' } })
    .reply(200, { pageInfo: {}, results }, { headers: { 'content-type': 'application/json' } })
}

describe('requests routes (seerr as source of truth)', () => {
  let ctx: ReturnType<typeof createTestContext>
  let app: FastifyInstance
  let token: string

  beforeEach(async () => {
    ctx = createTestContext()
    app = createServer(ctx.config)
    token = await loginWithSeerrSession(app, ctx)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('maps the full status table on GET /api/requests', async () => {
    interceptRequestList(ctx, [
      seerrRequest({ id: 1, status: 1, media: { mediaType: 'movie', tmdbId: 1, status: 5, title: 'A' } }),
      seerrRequest({ id: 2, status: 3, media: { mediaType: 'movie', tmdbId: 2, status: 1, title: 'B' } }),
      seerrRequest({ id: 3, status: 4, media: { mediaType: 'movie', tmdbId: 3, status: 1, title: 'C' } }),
      seerrRequest({ id: 4, status: 2, media: { mediaType: 'movie', tmdbId: 4, status: 5, title: 'D' } }),
      seerrRequest({ id: 5, status: 2, media: { mediaType: 'movie', tmdbId: 5, status: 3, title: 'E' } }),
      seerrRequest({ id: 6, status: 2, media: { mediaType: 'movie', tmdbId: 6, status: 1, title: 'F' } }),
    ])

    const response = await app.inject({
      method: 'GET',
      url: '/api/requests',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.statusCode).toBe(200)
    const { requests } = response.json()
    expect(requests.map((r: { status: string }) => r.status)).toEqual([
      'pending', 'declined', 'failed', 'available', 'processing', 'approved',
    ])
    expect(requests.map((r: { canCancel: boolean }) => r.canCancel)).toEqual([
      true, false, false, false, false, true,
    ])
  })

  it('enriches missing titles via media details and caches them', async () => {
    interceptRequestList(ctx, [
      seerrRequest({ media: { mediaType: 'movie', tmdbId: 550, status: 1 } }),
    ])
    ctx.seerr
      .intercept({ path: '/api/v1/movie/550', method: 'GET' })
      .reply(200, { id: 550, title: 'Fight Club', overview: '' }, { headers: { 'content-type': 'application/json' } })

    const response = await app.inject({
      method: 'GET',
      url: '/api/requests',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.json().requests[0].title).toBe('Fight Club')

    // Zweiter Abruf: kein neuer /api/v1/movie/550-Intercept nötig (Cache).
    interceptRequestList(ctx, [
      seerrRequest({ media: { mediaType: 'movie', tmdbId: 550, status: 1 } }),
    ])
    const second = await app.inject({
      method: 'GET',
      url: '/api/requests',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(second.json().requests[0].title).toBe('Fight Club')
  })

  it('sends selected seasons on POST and returns the fresh list', async () => {
    let seenBody: Record<string, unknown> | undefined
    ctx.seerr
      .intercept({
        path: '/api/v1/request',
        method: 'POST',
        body: (raw) => {
          seenBody = JSON.parse(raw as string) as Record<string, unknown>
          return true
        },
      })
      .reply(201, seerrRequest({ id: 20, status: 2, media: { mediaType: 'tv', tmdbId: 1399, status: 2 }, seasons: [{ seasonNumber: 1 }, { seasonNumber: 3 }] }), { headers: { 'content-type': 'application/json' } })
    interceptRequestList(ctx, [
      seerrRequest({ id: 20, status: 2, media: { mediaType: 'tv', tmdbId: 1399, status: 2, name: 'Game of Thrones' }, seasons: [{ seasonNumber: 1 }, { seasonNumber: 3 }] }),
    ])

    const response = await app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: { mediaType: 'tv', tmdbId: 1399, title: 'Game of Thrones', seasons: [1, 3] },
    })

    expect(response.statusCode).toBe(200)
    expect(seenBody).toEqual({ mediaType: 'tv', mediaId: 1399, seasons: [1, 3] })
    expect(response.json().requests[0].seasons).toEqual([1, 3])
    expect(response.json().requests[0].status).toBe('approved')
  })

  it('rejects seasons on a movie request', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: { mediaType: 'movie', tmdbId: 550, title: 'Fight Club', seasons: [1] },
    })
    expect(response.statusCode).toBe(400)
  })

  it('passes a seerr quota error through on POST', async () => {
    ctx.seerr
      .intercept({ path: '/api/v1/request', method: 'POST' })
      .reply(403, { message: 'Quota exceeded' }, { headers: { 'content-type': 'application/json' } })

    const response = await app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: { mediaType: 'movie', tmdbId: 550, title: 'Fight Club' },
    })
    expect(response.statusCode).toBe(403)
    expect(response.json().error).toBe('Quota exceeded')
  })

  it('cancels a request on DELETE and returns the fresh list', async () => {
    ctx.seerr.intercept({ path: '/api/v1/request/10', method: 'DELETE' }).reply(204)
    interceptRequestList(ctx, [])

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/requests/10',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().requests).toEqual([])
  })

  it('passes a seerr permission error through on DELETE', async () => {
    ctx.seerr
      .intercept({ path: '/api/v1/request/10', method: 'DELETE' })
      .reply(403, { message: 'You do not have permission to delete this request.' }, { headers: { 'content-type': 'application/json' } })

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/requests/10',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(response.statusCode).toBe(403)
  })

  it('returns tv media detail with season availabilities', async () => {
    ctx.seerr
      .intercept({ path: '/api/v1/tv/1399', method: 'GET' })
      .reply(200, {
        id: 1399,
        name: 'Game of Thrones',
        firstAirDate: '2011-04-17',
        overview: 'Winter is coming.',
        mediaInfo: { status: 4, seasons: [{ seasonNumber: 1, status: 5 }, { seasonNumber: 2, status: 2 }] },
        seasons: [
          { seasonNumber: 0, name: 'Specials' },
          { seasonNumber: 1, name: 'Season 1' },
          { seasonNumber: 2, name: 'Season 2' },
          { seasonNumber: 3, name: 'Season 3' },
        ],
      }, { headers: { 'content-type': 'application/json' } })

    const response = await app.inject({
      method: 'GET',
      url: '/api/media/tv/1399',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.item.availability).toBe('partiallyAvailable')
    expect(body.seasons).toEqual([
      { seasonNumber: 1, name: 'Season 1', availability: 'available' },
      { seasonNumber: 2, name: 'Season 2', availability: 'requested' },
      { seasonNumber: 3, name: 'Season 3', availability: 'requestable' },
    ])
  })

  it('returns movie media detail from the canonical endpoint without seasons', async () => {
    ctx.seerr
      .intercept({ path: '/api/v1/movie/550', method: 'GET' })
      .reply(200, { id: 550, title: 'Fight Club', releaseDate: '1999-10-15', overview: '...' }, { headers: { 'content-type': 'application/json' } })

    const response = await app.inject({
      method: 'GET',
      url: '/api/media/movie/550',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().item.title).toBe('Fight Club')
    expect(response.json().seasons).toBeUndefined()
  })
})
