import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../src/server.js'
import { createTestContext, jellyfinAuthResponse } from './helpers.js'

describe('POST /api/requests uses the user seerr session', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('sends the request with the user cookie, not the api key', async () => {
    ctx.jellyfin
      .intercept({ path: '/Users/AuthenticateByName', method: 'POST' })
      .reply(200, jellyfinAuthResponse(), { headers: { 'content-type': 'application/json' } })
    ctx.seerr
      .intercept({ path: '/api/v1/auth/jellyfin', method: 'POST' })
      .reply(200, { id: 1 }, { headers: { 'set-cookie': 'connect.sid=s%3Auser; Path=/' } })

    let seenCookie = ''
    let seenApiKey: string | undefined
    ctx.seerr
      .intercept({
        path: '/api/v1/request',
        method: 'POST',
        headers: (headers) => {
          seenCookie = headers.cookie ?? ''
          seenApiKey = headers['x-api-key']
          return true
        },
      })
      .reply(201, { id: 42 }, { headers: { 'content-type': 'application/json' } })

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

    expect(response.statusCode).toBe(200)
    expect(seenCookie).toBe('connect.sid=s%3Auser')
    expect(seenApiKey).toBeUndefined()
  })

  it('ends the lolarr session when the jellyfin token is no longer valid (401 cascade)', async () => {
    ctx.jellyfin
      .intercept({ path: '/Users/AuthenticateByName', method: 'POST' })
      .reply(200, jellyfinAuthResponse(), { headers: { 'content-type': 'application/json' } })
    // Kein Seerr-Login-Intercept → kein Cookie gespeichert; Request erzwingt Silent-QC.
    ctx.seerr
      .intercept({ path: '/api/v1/auth/jellyfin/quickconnect/initiate', method: 'POST' })
      .reply(200, { code: '654321', secret: 'seerr-qc-secret' }, { headers: { 'content-type': 'application/json' } })
    ctx.jellyfin
      .intercept({ path: '/QuickConnect/Authorize', method: 'POST', query: { code: '654321' } })
      .reply(401, {}) // Jellyfin-Token wurde revoked

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
    expect(response.statusCode).toBe(401)
    expect(response.json().error).toBe('session_expired')

    // Session ist serverseitig gelöscht — Folgerequest scheitert bereits am Auth-Hook.
    const followUp = await app.inject({
      method: 'GET',
      url: '/api/requests',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(followUp.statusCode).toBe(401)
  })
})
