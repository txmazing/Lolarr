import type { FastifyInstance } from 'fastify'
import { createRequestSchema } from '@lolarr/domain'
import type { AppContext } from '../lib/context.js'

export async function requestsRoutes(app: FastifyInstance, { database, seerr }: AppContext) {
  app.get('/api/requests', async (request) => {
    return {
      requests: database.listRequests(request.session.user.id),
    }
  })

  app.post('/api/requests', async (request) => {
    const payload = createRequestSchema.parse(request.body)

    const seerrRequest = await seerr.requestMedia(
      request.session.user.id,
      payload.mediaType,
      payload.tmdbId,
    )
    const requests = database.createRequest({
      ...payload,
      requestedBy: request.session.user,
      status: seerrRequest.status,
      seerrRequestId: seerrRequest.seerrRequestId,
    })

    return { requests }
  })
}
