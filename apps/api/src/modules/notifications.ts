import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../lib/context.js'

export async function notificationsRoutes(app: FastifyInstance, { database }: AppContext) {
  app.get('/api/notifications', async (request) => {
    const userId = request.session.user.id
    return {
      notifications: database.listNotifications(userId),
      unreadCount: database.countUnread(userId),
    }
  })

  app.post('/api/notifications/read', async (request) => {
    const userId = request.session.user.id
    database.markNotificationsRead(userId)
    return { unreadCount: database.countUnread(userId) }
  })
}
