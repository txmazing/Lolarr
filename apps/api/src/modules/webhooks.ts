import { randomUUID, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { mapWebhookToNotification, seerrWebhookSchema } from '../adapters/seerrWebhook.js'
import type { AppContext } from '../lib/context.js'

// Public endpoint: rate-limit like the other unauthenticated routes.
const WEBHOOK_RATE_LIMIT = { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }

export async function webhooksRoutes(app: FastifyInstance, { config, database }: AppContext) {
  app.post('/api/webhooks/seerr', WEBHOOK_RATE_LIMIT, async (request, reply) => {
    if (!isAuthorized(request.headers.authorization, config.LOLARR_WEBHOOK_SECRET)) {
      return reply.code(401).send({ error: 'Invalid webhook secret' })
    }

    const parsed = seerrWebhookSchema.safeParse(request.body)
    if (!parsed.success) {
      request.log.warn(
        { body: request.body, issues: parsed.error.issues },
        'seerr webhook payload rejected',
      )
      return reply.code(400).send({ error: 'Malformed webhook payload' })
    }

    const mapped = mapWebhookToNotification(parsed.data)
    if (!mapped) {
      return { ok: true }
    }

    const user = database.findUserByName(mapped.username)
    if (!user) {
      request.log.warn({ username: mapped.username }, 'seerr webhook for an unknown user — dropped')
      return { ok: true }
    }

    database.insertNotification({
      id: randomUUID(),
      userId: user.id,
      kind: mapped.kind,
      tmdbId: mapped.tmdbId,
      mediaType: mapped.mediaType,
      title: mapped.title,
    })
    return { ok: true }
  })
}

function isAuthorized(header: string | undefined, secret: string): boolean {
  if (!header) {
    return false
  }
  const provided = Buffer.from(header)
  const expected = Buffer.from(secret)
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}
