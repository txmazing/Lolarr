import type { FastifyInstance } from 'fastify'
import type { LolarrDatabase, StoredSession } from '../services/database.js'

declare module 'fastify' {
  interface FastifyRequest {
    session: StoredSession
  }
}

const PUBLIC_PREFIXES = ['/api/auth/']
const PUBLIC_PATHS = ['/health']

export function registerAuthHook(app: FastifyInstance, database: LolarrDatabase) {
  app.decorateRequest('session', undefined as unknown as StoredSession)

  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0] ?? request.url

    if (PUBLIC_PATHS.includes(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p))) {
      return
    }

    const token = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1]
    const session = token ? database.findSession(token) : undefined

    if (!session) {
      return reply.code(401).send({ error: 'Authentication required' })
    }

    request.session = session
  })
}
