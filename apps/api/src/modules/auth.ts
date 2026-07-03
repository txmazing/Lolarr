import type { FastifyInstance } from 'fastify'
import { loginRequestSchema } from '@lolarr/domain'
import { authenticateWithJellyfin } from '../adapters/jellyfin.js'
import type { AppContext } from '../lib/context.js'

export async function authRoutes(app: FastifyInstance, { config, database }: AppContext) {
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
}
