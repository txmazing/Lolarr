import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../lib/context.js'
import { GATEWAY_DEVICE_ID } from '../lib/constants.js'
import { JellyfinTokenInvalidError } from '../lib/errors.js'
import { getLibraryDetail, type JellyfinUserAuth } from '../adapters/jellyfinLibrary.js'

export async function libraryRoutes(app: FastifyInstance, { config, database }: AppContext) {
  app.get('/api/library/:itemId', async (request, reply) => {
    // Fastify only matches this route with :itemId set — no empty check needed.
    const { itemId } = request.params as { itemId: string }

    const userId = request.session.user.id
    const accessToken = database.getJellyfinToken(userId)
    if (!accessToken) {
      throw new JellyfinTokenInvalidError(userId)
    }
    const auth: JellyfinUserAuth = { accessToken, userId, deviceId: GATEWAY_DEVICE_ID }

    const detail = await getLibraryDetail(config, auth, itemId)
    if (!detail) {
      return reply.code(404).send({ error: 'Item not found' })
    }
    return detail
  })
}
