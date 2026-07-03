import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { loginRequestSchema, qcInitiateRequestSchema } from '@lolarr/domain'
import {
  authenticateByName,
  authenticateWithQuickConnect,
  getQuickConnectState,
  initiateQuickConnect,
} from '../adapters/jellyfin.js'
import type { AppContext } from '../lib/context.js'

type PendingQuickConnect = { secret: string; deviceId: string; createdAt: number }
const QC_TTL_MS = 10 * 60 * 1000

export async function authRoutes(
  app: FastifyInstance,
  { config, database, seerrSession }: AppContext,
) {
  const pendingQuickConnects = new Map<string, PendingQuickConnect>()

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

  app.post('/api/auth/qc/initiate', async (request) => {
    const { deviceId } = qcInitiateRequestSchema.parse(request.body)
    const { code, secret } = await initiateQuickConnect(config, deviceId)
    const pollToken = randomUUID()
    pendingQuickConnects.set(pollToken, { secret, deviceId, createdAt: Date.now() })
    return { code, pollToken }
  })

  app.get('/api/auth/qc/state', async (request, reply) => {
    prune(pendingQuickConnects)
    const pollToken = readPollToken(request.query)
    const pending = pollToken ? pendingQuickConnects.get(pollToken) : undefined

    if (!pollToken || !pending) {
      return reply.code(404).send({ error: 'Unknown or expired poll token' })
    }

    const state = await getQuickConnectState(config, pending.secret, pending.deviceId)
    if (!state.authenticated) {
      return { status: 'pending' }
    }

    pendingQuickConnects.delete(pollToken)
    const auth = await authenticateWithQuickConnect(config, pending.secret, pending.deviceId)
    database.upsertUser(auth.user, auth.accessToken)

    try {
      await seerrSession.ensureSession(auth.user.id)
    } catch (error) {
      request.log.warn({ err: error }, 'seerr silent quick connect failed during login')
    }

    const session = database.createSession(auth.user)
    return {
      status: 'authenticated',
      ...session,
      jellyfin: {
        url: config.JELLYFIN_URL,
        accessToken: auth.accessToken,
        userId: auth.user.id,
        deviceId: pending.deviceId,
      },
    }
  })

  app.get('/api/session/me', async (request) => {
    return { user: request.session.user }
  })
}

function prune(map: Map<string, PendingQuickConnect>) {
  const cutoff = Date.now() - QC_TTL_MS
  for (const [key, value] of map) {
    if (value.createdAt < cutoff) {
      map.delete(key)
    }
  }
}

function readPollToken(query: unknown): string | undefined {
  if (typeof query === 'object' && query !== null && 'pollToken' in query) {
    const value = (query as { pollToken: unknown }).pollToken
    return typeof value === 'string' && value.length > 0 ? value : undefined
  }
  return undefined
}
