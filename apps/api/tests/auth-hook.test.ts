import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../src/server.js'
import { createTestContext, jellyfinAuthResponse } from './helpers.js'

describe('auth hook', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it.each(['/api/discover', '/api/search?q=x', '/api/media/movie/1', '/api/requests'])(
    'rejects %s without a token',
    async (url) => {
      const app = createServer(ctx.config)
      const response = await app.inject({ method: 'GET', url })
      expect(response.statusCode).toBe(401)
    },
  )

  it('allows /health without a token', async () => {
    const app = createServer(ctx.config)
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(200)
  })

  it('allows authenticated requests through', async () => {
    ctx.jellyfin
      .intercept({ path: '/Users/AuthenticateByName', method: 'POST' })
      .reply(200, jellyfinAuthResponse(), { headers: { 'content-type': 'application/json' } })
    ctx.seerr
      .intercept({ path: '/api/v1/auth/jellyfin', method: 'POST' })
      .reply(200, {}, { headers: { 'set-cookie': 'connect.sid=s%3Aabc; Path=/' } })
    ctx.seerr
      .intercept({ path: /\/api\/v1\/discover\/.*/, method: 'GET' })
      .reply(200, { results: [] })
      .times(3)

    const app = createServer(ctx.config)
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'joel', password: 'pw', deviceId: 'device-123' },
    })
    const { token } = login.json()

    const response = await app.inject({
      method: 'GET',
      url: '/api/discover',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(response.statusCode).toBe(200)
  })
})
