import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createServer } from '../src/server.js'
import { LolarrDatabase } from '../src/services/database.js'
import { createTestContext, loginTestUser } from './helpers.js'

const SECRET = 'test-webhook-secret-1234'

function webhookBody(overrides: Record<string, unknown> = {}) {
  return {
    notification_type: 'MEDIA_AVAILABLE',
    subject: 'Fight Club (1999)',
    media: { media_type: 'movie', tmdbId: '550', status: 'available' },
    request: { request_id: '7', requestedBy_username: 'joel' },
    ...overrides,
  }
}

async function postWebhook(app: FastifyInstance, body: Record<string, unknown>, secret = SECRET) {
  return app.inject({
    method: 'POST',
    url: '/api/webhooks/seerr',
    headers: { authorization: secret, 'content-type': 'application/json' },
    payload: body,
  })
}

describe('POST /api/webhooks/seerr', () => {
  let ctx: ReturnType<typeof createTestContext>
  let app: FastifyInstance

  beforeEach(async () => {
    ctx = createTestContext()
    app = createServer(ctx.config)
    await loginTestUser(app, ctx) // creates user id 'jf-user-1', name 'Joel'
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  function storedNotifications() {
    const db = new LolarrDatabase(ctx.config.LOLARR_DATABASE_PATH, ctx.config.LOLARR_SECRET)
    return db.listNotifications('jf-user-1')
  }

  it('rejects a wrong secret with 401', async () => {
    const response = await postWebhook(app, webhookBody(), 'wrong-secret')
    expect(response.statusCode).toBe(401)
    expect(storedNotifications()).toHaveLength(0)
  })

  it('rejects a malformed body with 400', async () => {
    const response = await postWebhook(app, { hello: 'world' })
    expect(response.statusCode).toBe(400)
  })

  it('returns 400 for an unparseable JSON body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/seerr',
      headers: { authorization: SECRET, 'content-type': 'application/json' },
      payload: '{invalid',
    })
    expect(response.statusCode).toBe(400)
  })

  it('stores a notification for a matching user (200)', async () => {
    const response = await postWebhook(app, webhookBody())
    expect(response.statusCode).toBe(200)
    const rows = storedNotifications()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: 'available', tmdbId: 550, title: 'Fight Club (1999)' })
  })

  it('accepts the Seerr Test notification (empty media) as a 200 no-op', async () => {
    const response = await postWebhook(app, {
      notification_type: 'TEST_NOTIFICATION',
      subject: 'Test Notification',
      media: { media_type: '', tmdbId: '', status: '' },
      request: { requestedBy_username: '' },
    })
    expect(response.statusCode).toBe(200)
    expect(storedNotifications()).toHaveLength(0)
  })

  it('acks but drops a no-op notification type (200, no row)', async () => {
    const response = await postWebhook(app, webhookBody({ notification_type: 'TEST_NOTIFICATION' }))
    expect(response.statusCode).toBe(200)
    expect(storedNotifications()).toHaveLength(0)
  })

  it('acks but drops an unknown user (200, no row)', async () => {
    const response = await postWebhook(app, webhookBody({ request: { requestedBy_username: 'stranger' } }))
    expect(response.statusCode).toBe(200)
    expect(storedNotifications()).toHaveLength(0)
  })

  it('dedupes repeated webhooks for the same event', async () => {
    await postWebhook(app, webhookBody())
    await postWebhook(app, webhookBody())
    expect(storedNotifications()).toHaveLength(1)
  })
})
