import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import {
  InvalidCredentialsError,
  JellyfinTokenInvalidError,
  UpstreamError,
} from '../lib/errors.js'

export function registerErrorHandler(app: FastifyInstance) {
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
      return reply.code(401).send({ error: 'session_expired' })
    }

    if (error instanceof UpstreamError) {
      request.log.error({ err: error }, 'upstream request failed')
      return reply.code(502).send({ error: `${error.service}_unreachable` })
    }

    request.log.error({ err: error }, 'unhandled error')
    return reply.code(500).send({ error: 'internal_error' })
  })
}
