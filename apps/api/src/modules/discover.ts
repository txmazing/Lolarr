import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../lib/context.js'

export async function discoverRoutes(app: FastifyInstance, { seerr }: AppContext) {
  app.get('/api/discover', async () => ({
    rows: await seerr.discover(),
  }))

  app.get('/api/search', async (request) => {
    const query = readQuery(request.query)
    return { query, results: await seerr.search(query) }
  })
}

function readQuery(query: unknown) {
  if (
    typeof query === 'object' &&
    query !== null &&
    'q' in query &&
    typeof query.q === 'string'
  ) {
    return query.q
  }
  return ''
}
