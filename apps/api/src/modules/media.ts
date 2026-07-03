import type { FastifyInstance } from 'fastify'
import { mediaTypeSchema } from '@lolarr/domain'
import type { AppContext } from '../lib/context.js'

export async function mediaRoutes(app: FastifyInstance, { seerr }: AppContext) {
  app.get('/api/media/:mediaType/:tmdbId', async (request, reply) => {
    const params = request.params as { mediaType?: string; tmdbId?: string }
    const mediaType = mediaTypeSchema.parse(params.mediaType)
    const tmdbId = Number(params.tmdbId)

    if (!Number.isInteger(tmdbId)) {
      return reply.code(400).send({ error: 'Invalid TMDB id' })
    }

    const item = await seerr.media(mediaType, tmdbId)

    if (!item) {
      return reply.code(404).send({ error: 'Media item not found' })
    }

    return { item }
  })
}
