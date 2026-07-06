import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../src/server.js'
import { createTestContext } from './helpers.js'

describe('cors configuration', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('reflects any origin when LOLARR_CORS_ORIGIN is unset', async () => {
    const app = createServer(ctx.config)
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://anywhere.example' },
    })
    expect(response.headers['access-control-allow-origin']).toBe('http://anywhere.example')
  })

  it('allows only the configured origins when LOLARR_CORS_ORIGIN is set', async () => {
    const app = createServer({
      ...ctx.config,
      LOLARR_CORS_ORIGIN: 'http://tv.local,https://lolarr.example',
    })

    const allowed = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://lolarr.example' },
    })
    expect(allowed.headers['access-control-allow-origin']).toBe('https://lolarr.example')

    const denied = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://evil.example' },
    })
    expect(denied.headers['access-control-allow-origin']).toBeUndefined()
  })
})
