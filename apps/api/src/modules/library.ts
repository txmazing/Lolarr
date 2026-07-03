import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../lib/context.js'
import { JellyfinTokenInvalidError } from '../lib/errors.js'
import { getLibraryDetail, type JellyfinUserAuth } from '../adapters/jellyfinLibrary.js'

const GATEWAY_DEVICE_ID = 'lolarr-gateway'

export async function libraryRoutes(app: FastifyInstance, { config, database }: AppContext) {
  app.get('/api/library/:itemId', async (request, reply) => {
    const params = request.params as { itemId?: string }
    if (!params.itemId) {
      return reply.code(400).send({ error: 'Invalid item id' })
    }

    const userId = request.session.user.id
    const accessToken = database.getJellyfinToken(userId)
    if (!accessToken) {
      throw new JellyfinTokenInvalidError(userId)
    }
    const auth: JellyfinUserAuth = { accessToken, userId, deviceId: GATEWAY_DEVICE_ID }

    const detail = await getLibraryDetail(config, auth, params.itemId)
    if (!detail) {
      return reply.code(404).send({ error: 'Item not found' })
    }
    return detail
  })
}
