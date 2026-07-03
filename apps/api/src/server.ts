import cors from '@fastify/cors'
import Fastify from 'fastify'
import type { AppConfig } from './config.js'
import { SeerrAdapter } from './adapters/seerr.js'
import type { AppContext } from './lib/context.js'
import { authRoutes } from './modules/auth.js'
import { discoverRoutes } from './modules/discover.js'
import { mediaRoutes } from './modules/media.js'
import { requestsRoutes } from './modules/requests.js'
import { registerAuthHook } from './plugins/auth.js'
import { registerErrorHandler } from './plugins/errors.js'
import { LolarrDatabase } from './services/database.js'
import { SeerrSessionService } from './services/seerrSession.js'

export function createServer(config: AppConfig) {
  const app = Fastify({ logger: true })
  const database = new LolarrDatabase(config.LOLARR_DATABASE_PATH, config.LOLARR_SECRET)
  const seerrSession = new SeerrSessionService(config, database)
  const context: AppContext = {
    config,
    database,
    seerr: new SeerrAdapter(config, seerrSession),
    seerrSession,
  }

  app.register(cors, { origin: true })
  registerErrorHandler(app, database)
  registerAuthHook(app, context.database)

  app.get('/health', async () => ({ ok: true }))

  app.register(authRoutes, context)
  app.register(discoverRoutes, context)
  app.register(mediaRoutes, context)
  app.register(requestsRoutes, context)

  return app
}
