import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../src/server.js'
import { createTestContext } from './helpers.js'

describe('error handling', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('returns 400 for invalid request bodies', async () => {
    const app = createServer(ctx.config)
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 42 },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json()).toHaveProperty('error')
  })

  it('returns 502 when an upstream service fails', async () => {
    ctx.jellyfin
      .intercept({ path: '/Users/AuthenticateByName', method: 'POST' })
      .reply(500, 'boom')
    const app = createServer(ctx.config)
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'joel', password: 'pw', deviceId: 'device-123' },
    })
    // Hinweis: deviceId wird erst in Task 13 Teil des Schemas; bis dahin ignoriert Zod das Feld.
    expect(response.statusCode).toBe(502)
    expect(response.json().error).toBe('jellyfin_unreachable')
  })
})
