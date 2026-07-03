import type { FastifyInstance } from 'fastify'
import { loginRequestSchema } from '@lolarr/domain'
import { authenticateByName } from '../adapters/jellyfin.js'
import type { AppContext } from '../lib/context.js'

export async function authRoutes(app: FastifyInstance, { config, database }: AppContext) {
  app.post('/api/auth/login', async (request) => {
    const credentials = loginRequestSchema.parse(request.body)

    const auth = await authenticateByName(config, {
      username: credentials.username,
      password: credentials.password,
      deviceId: 'lolarr-gateway',
    })

    database.upsertUser(auth.user, auth.accessToken)
    return database.createSession(auth.user)
  })

  app.get('/api/session/me', async (request) => {
    return { user: request.session.user }
  })
}
