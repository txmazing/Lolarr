import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { JellyfinTokenInvalidError } from '../src/lib/errors.js'
import { LolarrDatabase } from '../src/services/database.js'
import { SeerrSessionService } from '../src/services/seerrSession.js'
import { createTestContext } from './helpers.js'

const user = { id: 'user-1', name: 'Joel' }
const SID = 'connect.sid=s%3Afresh; Path=/; HttpOnly'

function mockSilentQuickConnect(ctx: ReturnType<typeof createTestContext>) {
  ctx.seerr
    .intercept({ path: '/api/v1/auth/jellyfin/quickconnect/initiate', method: 'POST' })
    .reply(200, { code: '654321', secret: 'seerr-qc-secret' }, { headers: { 'content-type': 'application/json' } })
  ctx.jellyfin
    .intercept({ path: '/QuickConnect/Authorize', method: 'POST', query: { code: '654321' } })
    .reply(200, 'true')
  ctx.seerr
    .intercept({ path: '/api/v1/auth/jellyfin/quickconnect/authenticate', method: 'POST' })
    .reply(200, { id: 1 }, { headers: { 'set-cookie': SID, 'content-type': 'application/json' } })
}

describe('SeerrSessionService', () => {
  let ctx: ReturnType<typeof createTestContext>
  let db: LolarrDatabase
  let service: SeerrSessionService

  beforeEach(() => {
    ctx = createTestContext()
    db = new LolarrDatabase(ctx.config.LOLARR_DATABASE_PATH, ctx.config.LOLARR_SECRET)
    db.upsertUser(user, 'jf-user-token')
    service = new SeerrSessionService(ctx.config, db)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('stores the cookie from a password login', async () => {
    ctx.seerr
      .intercept({ path: '/api/v1/auth/jellyfin', method: 'POST' })
      .reply(200, { id: 1 }, { headers: { 'set-cookie': SID, 'content-type': 'application/json' } })

    await service.loginWithPassword(user.id, 'joel', 'pw')
    expect(db.getSeerrCookie(user.id)).toBe('connect.sid=s%3Afresh')
  })

  it('acquires a session via silent quick connect when none exists', async () => {
    mockSilentQuickConnect(ctx)
    const cookie = await service.ensureSession(user.id)
    expect(cookie).toBe('connect.sid=s%3Afresh')
    expect(db.getSeerrCookie(user.id)).toBe('connect.sid=s%3Afresh')
  })

  it('renews the cookie once when seerr answers 401', async () => {
    db.saveSeerrCookie(user.id, 'connect.sid=s%3Astale')
    ctx.seerr
      .intercept({ path: '/api/v1/request', method: 'GET' })
      .reply(401, {})
    mockSilentQuickConnect(ctx)
    ctx.seerr
      .intercept({ path: '/api/v1/request', method: 'GET' })
      .reply(200, { results: [] }, { headers: { 'content-type': 'application/json' } })

    const result = await service.fetchWithSession(user.id, '/api/v1/request')
    expect(result).toEqual({ results: [] })
  })

  it('maps a rejected jellyfin token to JellyfinTokenInvalidError', async () => {
    ctx.seerr
      .intercept({ path: '/api/v1/auth/jellyfin/quickconnect/initiate', method: 'POST' })
      .reply(200, { code: '654321', secret: 'seerr-qc-secret' }, { headers: { 'content-type': 'application/json' } })
    ctx.jellyfin
      .intercept({ path: '/QuickConnect/Authorize', method: 'POST', query: { code: '654321' } })
      .reply(401, {})

    await expect(service.ensureSession(user.id)).rejects.toBeInstanceOf(JellyfinTokenInvalidError)
  })
})
