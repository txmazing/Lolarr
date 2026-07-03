import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { MockAgent, setGlobalDispatcher } from 'undici'
import type { AppConfig } from '../src/config.js'

export const JELLYFIN_URL = 'http://jellyfin.test'
export const SEERR_URL = 'http://seerr.test'

export function createTestContext() {
  const databasePath = join(tmpdir(), `lolarr-test-${randomUUID()}.sqlite`)

  const config: AppConfig = {
    HOST: '127.0.0.1',
    PORT: 0,
    JELLYFIN_URL,
    SEERR_URL,
    SEERR_API_KEY: 'test-api-key',
    LOLARR_SECRET: 'test-secret-at-least-16-chars',
    LOLARR_DATABASE_PATH: databasePath,
  }

  const mockAgent = new MockAgent()
  mockAgent.disableNetConnect()
  setGlobalDispatcher(mockAgent)

  return {
    config,
    mockAgent,
    jellyfin: mockAgent.get(JELLYFIN_URL),
    seerr: mockAgent.get(SEERR_URL),
    async cleanup() {
      await mockAgent.close()
      rmSync(databasePath, { force: true })
    },
  }
}

export function jellyfinAuthResponse(overrides: Record<string, unknown> = {}) {
  return {
    AccessToken: 'jf-access-token',
    User: { Id: 'jf-user-1', Name: 'Joel' },
    ...overrides,
  }
}

export async function loginTestUser(app: FastifyInstance, ctx: ReturnType<typeof createTestContext>) {
  ctx.jellyfin
    .intercept({ path: '/Users/AuthenticateByName', method: 'POST' })
    .reply(200, jellyfinAuthResponse(), { headers: { 'content-type': 'application/json' } })

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'joel', password: 'pw', deviceId: 'device-12345' },
  })
  return response.json() as { token: string }
}
