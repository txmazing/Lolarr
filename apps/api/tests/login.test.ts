import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../src/server.js'
import { createTestContext, jellyfinAuthResponse } from './helpers.js'

const loginPayload = { username: 'joel', password: 'pw', deviceId: 'web-device-1' }

describe('POST /api/auth/login', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
    ctx.jellyfin
      .intercept({ path: '/Users/AuthenticateByName', method: 'POST' })
      .reply(200, jellyfinAuthResponse(), { headers: { 'content-type': 'application/json' } })
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('returns session token plus jellyfin connection details', async () => {
    ctx.seerr
      .intercept({ path: '/api/v1/auth/jellyfin', method: 'POST' })
      .reply(200, { id: 1 }, { headers: { 'set-cookie': 'connect.sid=s%3Aabc; Path=/' } })

    const app = createServer(ctx.config)
    const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: loginPayload })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.token).toMatch(/^lolarr_/)
    expect(body.jellyfin).toEqual({
      url: ctx.config.JELLYFIN_URL,
      accessToken: 'jf-access-token',
      userId: 'jf-user-1',
      deviceId: 'web-device-1',
    })
  })

  it('still succeeds when seerr is down', async () => {
    ctx.seerr
      .intercept({ path: '/api/v1/auth/jellyfin', method: 'POST' })
      .reply(503, {})

    const app = createServer(ctx.config)
    const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: loginPayload })
    expect(response.statusCode).toBe(200)
  })

  it('rejects logins without a device id', async () => {
    const app = createServer(ctx.config)
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'joel', password: 'pw' },
    })
    expect(response.statusCode).toBe(400)
  })
})
