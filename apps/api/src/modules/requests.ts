import type { FastifyInstance } from 'fastify'
import { createRequestSchema } from '@lolarr/domain'
import type { AppContext } from '../lib/context.js'

export async function requestsRoutes(app: FastifyInstance, { seerr }: AppContext) {
  app.get('/api/requests', async (request) => {
    return { requests: await seerr.listRequests(request.session.user.id) }
  })

  app.post('/api/requests', async (request, reply) => {
    const payload = createRequestSchema.parse(request.body)

    if (payload.mediaType === 'movie' && payload.seasons) {
      return reply.code(400).send({ error: 'Seasons can only be requested for series' })
    }

    await seerr.requestMedia(request.session.user.id, payload)
    return { requests: await seerr.listRequests(request.session.user.id) }
  })

  app.delete('/api/requests/:id', async (request) => {
    const { id } = request.params as { id: string }
    await seerr.deleteRequest(request.session.user.id, id)
    return { requests: await seerr.listRequests(request.session.user.id) }
  })
}
