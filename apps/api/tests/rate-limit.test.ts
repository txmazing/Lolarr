import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../src/server.js'
import { createTestContext } from './helpers.js'

describe('auth rate limiting', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('throttles repeated quick connect initiations', async () => {
    ctx.jellyfin
      .intercept({ path: '/QuickConnect/Initiate', method: 'POST' })
      .reply(200, { Code: '123456', Secret: 'jf-qc-secret' }, { headers: { 'content-type': 'application/json' } })
      .persist()

    const app = createServer(ctx.config)

    for (let i = 0; i < 10; i += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/qc/initiate',
        payload: { deviceId: 'tv-device-1' },
      })
      expect(response.statusCode).toBe(200)
    }

    const throttled = await app.inject({
      method: 'POST',
      url: '/api/auth/qc/initiate',
      payload: { deviceId: 'tv-device-1' },
    })
    expect(throttled.statusCode).toBe(429)
  })

  it('throttles repeated login attempts', async () => {
    ctx.jellyfin
      .intercept({ path: '/Users/AuthenticateByName', method: 'POST' })
      .reply(401, {})
      .persist()

    const app = createServer(ctx.config)

    for (let i = 0; i < 10; i += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'joel', password: 'wrong', deviceId: 'device-12345' },
      })
      expect(response.statusCode).toBe(401)
    }

    const throttled = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'joel', password: 'wrong', deviceId: 'device-12345' },
    })
    expect(throttled.statusCode).toBe(429)
  })

  it('does not throttle unrelated routes', async () => {
    const app = createServer(ctx.config)

    for (let i = 0; i < 15; i += 1) {
      const response = await app.inject({ method: 'GET', url: '/health' })
      expect(response.statusCode).toBe(200)
    }
  })
})
