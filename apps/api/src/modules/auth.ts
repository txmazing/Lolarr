import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { loginRequestSchema, qcInitiateRequestSchema, qcStateRequestSchema } from '@lolarr/domain'
import {
  authenticateByName,
  authenticateWithQuickConnect,
  getQuickConnectState,
  initiateQuickConnect,
} from '../adapters/jellyfin.js'
import type { AppContext } from '../lib/context.js'

type PendingQuickConnect = { secret: string; deviceId: string; createdAt: number }
const QC_TTL_MS = 10 * 60 * 1000

// The auth endpoints are public and each hit costs an upstream Jellyfin call
// (login, initiate) — keep them behind a per-IP limit. The QC state poll runs
// every 5s (12/min), so it gets more headroom than login/initiate.
const AUTH_RATE_LIMIT = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }
const QC_POLL_RATE_LIMIT = { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }

export async function authRoutes(
  app: FastifyInstance,
  { config, database, seerrSession }: AppContext,
) {
  const pendingQuickConnects = new Map<string, PendingQuickConnect>()

  app.post('/api/auth/login', AUTH_RATE_LIMIT, async (request) => {
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

  app.post('/api/auth/qc/initiate', AUTH_RATE_LIMIT, async (request) => {
    prune(pendingQuickConnects)
    const { deviceId } = qcInitiateRequestSchema.parse(request.body)
    const { code, secret } = await initiateQuickConnect(config, deviceId)
    const pollToken = randomUUID()
    pendingQuickConnects.set(pollToken, { secret, deviceId, createdAt: Date.now() })
    return { code, pollToken }
  })

  // POST with the token in the body — as a GET query param it would end up in
  // the request log (Fastify logs req.url).
  app.post('/api/auth/qc/state', QC_POLL_RATE_LIMIT, async (request, reply) => {
    prune(pendingQuickConnects)
    const { pollToken } = qcStateRequestSchema.parse(request.body)
    const pending = pendingQuickConnects.get(pollToken)

    if (!pending) {
      return reply.code(404).send({ error: 'Unknown or expired poll token' })
    }

    // Claim before await: a poll token is single-use. Delete immediately to prevent concurrent
    // polls from both seeing authenticated:true. If the check is still pending — or the state
    // check itself throws (e.g. a transient Jellyfin error) — we re-insert it below so the
    // token isn't lost while the underlying Quick Connect code is still valid.
    pendingQuickConnects.delete(pollToken)

    let state: Awaited<ReturnType<typeof getQuickConnectState>>
    try {
      state = await getQuickConnectState(config, pending.secret, pending.deviceId)
    } catch (error) {
      // Transient failure checking state — re-insert so the client can retry with the same
      // pollToken instead of losing the in-flight Quick Connect code.
      pendingQuickConnects.set(pollToken, pending)
      throw error
    }

    if (!state.authenticated) {
      // Not authenticated yet — re-insert the token so the client can poll again
      pendingQuickConnects.set(pollToken, pending)
      return { status: 'pending' }
    }

    // Token is claimed and authentication succeeded. If authenticateWithQuickConnect fails below,
    // the token is lost and the client must re-initiate (acceptable trade-off for simplicity).
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
