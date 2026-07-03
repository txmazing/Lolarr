import cors from '@fastify/cors'
import Fastify from 'fastify'
import {
  createRequestSchema,
  loginRequestSchema,
  mediaTypeSchema,
} from '@lolarr/domain'
import type { AppConfig } from './config.js'
import { authenticateWithJellyfin } from './adapters/jellyfin.js'
import { SeerrAdapter } from './adapters/seerr.js'
import { registerAuthHook } from './plugins/auth.js'
import { registerErrorHandler } from './plugins/errors.js'
import { LolarrDatabase } from './services/database.js'

export function createServer(config: AppConfig) {
  const app = Fastify({ logger: true })
  const database = new LolarrDatabase(config.LOLARR_DATABASE_PATH, config.LOLARR_SECRET)
  const seerr = new SeerrAdapter(config)

  app.register(cors, {
    origin: true,
  })

  registerErrorHandler(app)
  registerAuthHook(app, database)

  app.get('/health', async () => ({ ok: true }))

  app.post('/api/auth/login', async (request) => {
    const credentials = loginRequestSchema.parse(request.body)

    const auth = await authenticateWithJellyfin(
      config,
      credentials.username,
      credentials.password,
    )

    database.upsertUser(auth.user, auth.accessToken)
    return database.createSession(auth.user)
  })

  app.get('/api/session/me', async (request) => {
    return { user: request.session.user }
  })

  app.get('/api/discover', async () => ({
    rows: await seerr.discover(),
  }))

  app.get('/api/search', async (request) => {
    const query = readQuery(request.query)

    return {
      query,
      results: await seerr.search(query),
    }
  })

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

  app.get('/api/requests', async () => {
    return {
      requests: database.listRequests(),
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

  return app
}

function readQuery(query: unknown) {
  if (
    typeof query === 'object' &&
    query !== null &&
    'q' in query &&
    typeof query.q === 'string'
  ) {
    return query.q
  }

  return ''
}
