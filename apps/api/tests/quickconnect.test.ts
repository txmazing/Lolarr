import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { errorResponseSchema } from '@lolarr/domain'
import { createServer } from '../src/server.js'
import { createTestContext, jellyfinAuthResponse } from './helpers.js'

describe('quick connect login', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('initiates, polls pending, then authenticates', async () => {
    ctx.jellyfin
      .intercept({ path: '/QuickConnect/Initiate', method: 'POST' })
      .reply(200, { Code: '123456', Secret: 'jf-qc-secret' }, { headers: { 'content-type': 'application/json' } })
    ctx.jellyfin
      .intercept({ path: '/QuickConnect/Connect', method: 'GET', query: { secret: 'jf-qc-secret' } })
      .reply(200, { Authenticated: false }, { headers: { 'content-type': 'application/json' } })

    const app = createServer(ctx.config)

    const initiate = await app.inject({
      method: 'POST',
      url: '/api/auth/qc/initiate',
      payload: { deviceId: 'tv-device-1' },
    })
    expect(initiate.statusCode).toBe(200)
    const { code, pollToken } = initiate.json()
    expect(code).toBe('123456')
    expect(pollToken).not.toBe('jf-qc-secret')

    const pending = await app.inject({ method: 'POST', url: '/api/auth/qc/state', payload: { pollToken } })
    expect(pending.json()).toEqual({ status: 'pending' })

    ctx.jellyfin
      .intercept({ path: '/QuickConnect/Connect', method: 'GET', query: { secret: 'jf-qc-secret' } })
      .reply(200, { Authenticated: true }, { headers: { 'content-type': 'application/json' } })
    ctx.jellyfin
      .intercept({ path: '/Users/AuthenticateWithQuickConnect', method: 'POST' })
      .reply(200, jellyfinAuthResponse(), { headers: { 'content-type': 'application/json' } })
    // Seerr-Silent-QC schlägt fehl → Login muss trotzdem gelingen
    ctx.seerr
      .intercept({ path: '/api/v1/auth/jellyfin/quickconnect/initiate', method: 'POST' })
      .reply(503, {})

    const done = await app.inject({ method: 'POST', url: '/api/auth/qc/state', payload: { pollToken } })
    const body = done.json()
    expect(body.status).toBe('authenticated')
    expect(body.token).toMatch(/^lolarr_/)
    expect(body.jellyfin.deviceId).toBe('tv-device-1')
  })

  it('rejects unknown poll tokens with the shared error body shape', async () => {
    const app = createServer(ctx.config)
    const response = await app.inject({ method: 'POST', url: '/api/auth/qc/state', payload: { pollToken: 'nope' } })
    expect(response.statusCode).toBe(404)
    const body = errorResponseSchema.parse(response.json())
    expect(body.error).toMatch(/poll token/i)
  })

  it('expires poll tokens after the ttl so a late poll gets 404', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      ctx.jellyfin
        .intercept({ path: '/QuickConnect/Initiate', method: 'POST' })
        .reply(200, { Code: '123456', Secret: 'jf-qc-secret' }, { headers: { 'content-type': 'application/json' } })
      ctx.jellyfin
        .intercept({ path: '/QuickConnect/Connect', method: 'GET', query: { secret: 'jf-qc-secret' } })
        .reply(200, { Authenticated: false }, { headers: { 'content-type': 'application/json' } })
        .persist()

      const app = createServer(ctx.config)

      const initiate = await app.inject({
        method: 'POST',
        url: '/api/auth/qc/initiate',
        payload: { deviceId: 'tv-device-4' },
      })
      const { pollToken } = initiate.json()

      // Within the TTL the token still resolves.
      vi.setSystemTime(Date.now() + 9 * 60 * 1000)
      const pending = await app.inject({ method: 'POST', url: '/api/auth/qc/state', payload: { pollToken } })
      expect(pending.statusCode).toBe(200)
      expect(pending.json()).toEqual({ status: 'pending' })

      // Past the 10 minute TTL the prune path must drop it.
      vi.setSystemTime(Date.now() + 2 * 60 * 1000)
      const expired = await app.inject({ method: 'POST', url: '/api/auth/qc/state', payload: { pollToken } })
      expect(expired.statusCode).toBe(404)
    } finally {
      vi.useRealTimers()
    }
  })

  it('makes poll tokens single-use under concurrent polls', async () => {
    ctx.jellyfin
      .intercept({ path: '/QuickConnect/Initiate', method: 'POST' })
      .reply(200, { Code: '123456', Secret: 'jf-qc-secret' }, { headers: { 'content-type': 'application/json' } })

    const app = createServer(ctx.config)

    const initiate = await app.inject({
      method: 'POST',
      url: '/api/auth/qc/initiate',
      payload: { deviceId: 'tv-device-2' },
    })
    const { pollToken } = initiate.json()

    // Mock state as authenticated, but only allow ONE successful authenticateWithQuickConnect
    ctx.jellyfin
      .intercept({ path: '/QuickConnect/Connect', method: 'GET', query: { secret: 'jf-qc-secret' } })
      .reply(200, { Authenticated: true }, { headers: { 'content-type': 'application/json' } })
    ctx.jellyfin
      .intercept({ path: '/Users/AuthenticateWithQuickConnect', method: 'POST' })
      .reply(200, jellyfinAuthResponse(), { headers: { 'content-type': 'application/json' } })
    // Seerr succeeds
    ctx.seerr
      .intercept({ path: '/api/v1/auth/jellyfin/quickconnect/initiate', method: 'POST' })
      .reply(200, {})

    // Fire two concurrent requests on the same pollToken
    const [response1, response2] = await Promise.all([
      app.inject({ method: 'POST', url: '/api/auth/qc/state', payload: { pollToken } }),
      app.inject({ method: 'POST', url: '/api/auth/qc/state', payload: { pollToken } }),
    ])

    // Exactly one succeeds with authenticated status, the other gets 404 (token claimed and consumed)
    const responses = [response1, response2].sort((a, b) => a.statusCode - b.statusCode)
    expect(responses[0].statusCode).toBe(200)
    expect(responses[0].json().status).toBe('authenticated')
    expect(responses[1].statusCode).toBe(404)
  })

  it('re-inserts the poll token when the state check throws, so a retry with the same token still works', async () => {
    ctx.jellyfin
      .intercept({ path: '/QuickConnect/Initiate', method: 'POST' })
      .reply(200, { Code: '123456', Secret: 'jf-qc-secret' }, { headers: { 'content-type': 'application/json' } })

    const app = createServer(ctx.config)

    const initiate = await app.inject({
      method: 'POST',
      url: '/api/auth/qc/initiate',
      payload: { deviceId: 'tv-device-3' },
    })
    const { pollToken } = initiate.json()

    // First poll: Jellyfin state check fails transiently (e.g. 503 upstream).
    ctx.jellyfin
      .intercept({ path: '/QuickConnect/Connect', method: 'GET', query: { secret: 'jf-qc-secret' } })
      .reply(503, {})

    const failed = await app.inject({ method: 'POST', url: '/api/auth/qc/state', payload: { pollToken } })
    expect(failed.statusCode).toBeGreaterThanOrEqual(500)

    // Second poll with the SAME pollToken must not 404 — the token must have been re-inserted.
    ctx.jellyfin
      .intercept({ path: '/QuickConnect/Connect', method: 'GET', query: { secret: 'jf-qc-secret' } })
      .reply(200, { Authenticated: false }, { headers: { 'content-type': 'application/json' } })

    const retried = await app.inject({ method: 'POST', url: '/api/auth/qc/state', payload: { pollToken } })
    expect(retried.statusCode).toBe(200)
    expect(retried.json()).toEqual({ status: 'pending' })
  })
})
