import type { FastifyInstance } from 'fastify'
import { loginRequestSchema } from '@lolarr/domain'
import { authenticateByName } from '../adapters/jellyfin.js'
import type { AppContext } from '../lib/context.js'

export async function authRoutes(
  app: FastifyInstance,
  { config, database, seerrSession }: AppContext,
) {
  app.post('/api/auth/login', async (request) => {
    const credentials = loginRequestSchema.parse(request.body)

    const auth = await authenticateByName(config, credentials)
    database.upsertUser(auth.user, auth.accessToken)

    try {
      await seerrSession.loginWithPassword(auth.user.id, credentials.username, credentials.password)
    } catch (error) {
      request.log.warn({ err: error }, 'seerr login failed — will retry via silent quick connect')
    }

    const session = database.createSession(auth.user)
    return {
      ...session,
      jellyfin: {
        url: config.JELLYFIN_URL,
        accessToken: auth.accessToken,
        userId: auth.user.id,
        deviceId: credentials.deviceId,
      },
    }
  })

  app.get('/api/session/me', async (request) => {
    return { user: request.session.user }
  })
}
