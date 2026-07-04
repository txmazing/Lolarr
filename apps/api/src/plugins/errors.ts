import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import {
  InvalidCredentialsError,
  JellyfinTokenInvalidError,
  UpstreamError,
} from '../lib/errors.js'
import type { LolarrDatabase } from '../services/database.js'

export function registerErrorHandler(app: FastifyInstance, database: LolarrDatabase) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'validation_failed',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      })
    }

    if (error instanceof InvalidCredentialsError) {
      return reply.code(401).send({ error: 'Invalid Jellyfin credentials' })
    }

    if (error instanceof JellyfinTokenInvalidError) {
      database.deleteSessionsForUser(error.userId)
      return reply.code(401).send({ error: 'session_expired' })
    }

    if (error instanceof UpstreamError) {
      request.log.error({ err: error }, 'upstream request failed')
      // Seerr client errors (quota, permission, not found) carry a user-facing
      // message. 401 stays a 502: it only occurs after the silent-QC retry
      // failed, and returning 401 here would wrongly end the Lolarr session.
      if (
        error.service === 'seerr' &&
        error.status !== undefined &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 401
      ) {
        return reply.code(error.status).send({ error: error.message })
      }
      return reply.code(502).send({ error: `${error.service}_unreachable` })
    }

    // @fastify/rate-limit signals throttling by throwing a 429 — pass it
    // through instead of collapsing it into a 500.
    if (isRecord(error) && error.statusCode === 429) {
      return reply.code(429).send({ error: 'rate_limited' })
    }

    request.log.error({ err: error }, 'unhandled error')
    return reply.code(500).send({ error: 'internal_error' })
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
