import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../src/server.js'
import { createTestContext, jellyfinAuthResponse } from './helpers.js'

describe('error handling', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('returns 400 for invalid request bodies', async () => {
    const app = createServer(ctx.config)
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 42 },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json()).toHaveProperty('error')
  })

  it('returns 502 when an upstream service fails', async () => {
    ctx.jellyfin
      .intercept({ path: '/Users/AuthenticateByName', method: 'POST' })
      .reply(500, 'boom')
    const app = createServer(ctx.config)
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'joel', password: 'pw', deviceId: 'device-123' },
    })
    // Hinweis: deviceId wird erst in Task 13 Teil des Schemas; bis dahin ignoriert Zod das Feld.
    expect(response.statusCode).toBe(502)
    expect(response.json().error).toBe('jellyfin_unreachable')
  })

  it('passes seerr 4xx errors through with the seerr message', async () => {
    ctx.jellyfin
      .intercept({ path: '/Users/AuthenticateByName', method: 'POST' })
      .reply(200, jellyfinAuthResponse(), { headers: { 'content-type': 'application/json' } })
    ctx.seerr
      .intercept({ path: '/api/v1/auth/jellyfin', method: 'POST' })
      .reply(200, { id: 1 }, { headers: { 'set-cookie': 'connect.sid=s%3Auser; Path=/' } })
    ctx.seerr
      .intercept({ path: '/api/v1/request', method: 'POST' })
      .reply(403, { message: 'Quota exceeded' }, { headers: { 'content-type': 'application/json' } })

    const app = createServer(ctx.config)
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'joel', password: 'pw', deviceId: 'device-abc' },
    })
    const { token } = login.json()

    const response = await app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: { mediaType: 'movie', tmdbId: 550, title: 'Fight Club' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json().error).toBe('Quota exceeded')
  })

  it('keeps seerr 401 as 502 so the client session is not killed', async () => {
    ctx.jellyfin
      .intercept({ path: '/Users/AuthenticateByName', method: 'POST' })
      .reply(200, jellyfinAuthResponse(), { headers: { 'content-type': 'application/json' } })
    ctx.seerr
      .intercept({ path: '/api/v1/auth/jellyfin', method: 'POST' })
      .reply(200, { id: 1 }, { headers: { 'set-cookie': 'connect.sid=s%3Auser; Path=/' } })
    ctx.seerr
      .intercept({ path: '/api/v1/request', method: 'POST' })
      .reply(401, { message: 'whatever' }, { headers: { 'content-type': 'application/json' } })
    // 401 löst normalerweise Silent-QC-Retry aus; kein Jellyfin-Token vorhanden
    // (Login lief über Passwort, nicht QC) → silentQuickConnect wirft JellyfinTokenInvalidError.
    // Um wirklich den seerr-401-UpstreamError-Pfad zu testen, muss der Retry ebenfalls 401 liefern
    // und ein gültiges Jellyfin-Token vorliegen, damit der Retry durchläuft und erneut 401 zurückgibt.
    ctx.seerr
      .intercept({ path: '/api/v1/auth/jellyfin/quickconnect/initiate', method: 'POST' })
      .reply(200, { code: '654321', secret: 'seerr-qc-secret' }, { headers: { 'content-type': 'application/json' } })
    ctx.jellyfin
      .intercept({ path: '/QuickConnect/Authorize', method: 'POST', query: { code: '654321' } })
      .reply(200, 'true')
    ctx.seerr
      .intercept({ path: '/api/v1/auth/jellyfin/quickconnect/authenticate', method: 'POST' })
      .reply(200, { id: 1 }, { headers: { 'set-cookie': 'connect.sid=s%3Arenewed; Path=/', 'content-type': 'application/json' } })
    ctx.seerr
      .intercept({ path: '/api/v1/request', method: 'POST' })
      .reply(401, { message: 'whatever' }, { headers: { 'content-type': 'application/json' } })

    const app = createServer(ctx.config)
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'joel', password: 'pw', deviceId: 'device-abc' },
    })
    const { token } = login.json()

    const response = await app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: { mediaType: 'movie', tmdbId: 550, title: 'Fight Club' },
    })

    expect(response.statusCode).toBe(502)
    expect(response.json().error).toBe('seerr_unreachable')
  })
})
