import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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

    const pending = await app.inject({ method: 'GET', url: `/api/auth/qc/state?pollToken=${pollToken}` })
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

    const done = await app.inject({ method: 'GET', url: `/api/auth/qc/state?pollToken=${pollToken}` })
    const body = done.json()
    expect(body.status).toBe('authenticated')
    expect(body.token).toMatch(/^lolarr_/)
    expect(body.jellyfin.deviceId).toBe('tv-device-1')
  })

  it('rejects unknown poll tokens', async () => {
    const app = createServer(ctx.config)
    const response = await app.inject({ method: 'GET', url: '/api/auth/qc/state?pollToken=nope' })
    expect(response.statusCode).toBe(404)
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
      app.inject({ method: 'GET', url: `/api/auth/qc/state?pollToken=${pollToken}` }),
      app.inject({ method: 'GET', url: `/api/auth/qc/state?pollToken=${pollToken}` }),
    ])

    // Exactly one succeeds with authenticated status, the other gets 404 (token claimed and consumed)
    const responses = [response1, response2].sort((a, b) => a.statusCode - b.statusCode)
    expect(responses[0].statusCode).toBe(200)
    expect(responses[0].json().status).toBe('authenticated')
    expect(responses[1].statusCode).toBe(404)
  })
})
