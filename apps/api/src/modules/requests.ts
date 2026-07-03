import type { FastifyInstance } from 'fastify'
import { createRequestSchema } from '@lolarr/domain'
import type { AppContext } from '../lib/context.js'

export async function requestsRoutes(app: FastifyInstance, { database, seerr }: AppContext) {
  app.get('/api/requests', async (request) => {
    return {
      requests: database.listRequests(request.session.user.id),
    }
  })

  app.post('/api/requests', async (request, reply) => {
    const payload = createRequestSchema.parse(request.body)

    try {
      const seerrRequest = await seerr.requestMedia(payload.mediaType, payload.tmdbId)
      const requests = database.createRequest({
        ...payload,
        requestedBy: request.session.user,
        status: seerrRequest.status,
        seerrRequestId: seerrRequest.seerrRequestId,
      })

      return { requests }
    } catch {
      return reply.code(502).send({ error: 'Seerr request failed' })
    }
  })
}
