import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createServer } from '../src/server.js'
import { createTestContext, loginTestUser } from './helpers.js'

const SECRET = 'test-webhook-secret-1234'

async function seedWebhook(app: FastifyInstance, tmdbId: number, title: string) {
  await app.inject({
    method: 'POST',
    url: '/api/webhooks/seerr',
    headers: { authorization: SECRET, 'content-type': 'application/json' },
    payload: {
      notification_type: 'MEDIA_AVAILABLE',
      subject: title,
      media: { media_type: 'movie', tmdbId: String(tmdbId) },
      request: { requestedBy_username: 'joel' },
    },
  })
}

describe('notifications routes', () => {
  let ctx: ReturnType<typeof createTestContext>
  let app: FastifyInstance
  let token: string

  beforeEach(async () => {
    ctx = createTestContext()
    app = createServer(ctx.config)
    token = (await loginTestUser(app, ctx)).token
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('requires a session', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/notifications' })
    expect(response.statusCode).toBe(401)
  })

  it('returns notifications and the unread count', async () => {
    await seedWebhook(app, 550, 'Fight Club')
    const response = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.unreadCount).toBe(1)
    expect(body.notifications).toHaveLength(1)
    expect(body.notifications[0]).toMatchObject({ kind: 'available', title: 'Fight Club', read: false })
  })

  it('marks everything read', async () => {
    await seedWebhook(app, 550, 'Fight Club')
    const read = await app.inject({
      method: 'POST',
      url: '/api/notifications/read',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(read.statusCode).toBe(200)
    expect(read.json().unreadCount).toBe(0)

    const after = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(after.json().unreadCount).toBe(0)
    expect(after.json().notifications[0].read).toBe(true)
  })
})
