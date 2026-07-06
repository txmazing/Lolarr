import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  authenticateByName,
  authorizeQuickConnect,
  buildAuthorizationHeader,
  getQuickConnectState,
  initiateQuickConnect,
} from '../src/adapters/jellyfin.js'
import { InvalidCredentialsError, UpstreamError } from '../src/lib/errors.js'
import { createTestContext, jellyfinAuthResponse } from './helpers.js'

describe('jellyfin adapter', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('builds the MediaBrowser authorization header', () => {
    expect(buildAuthorizationHeader('device-1')).toBe(
      'MediaBrowser Client="Lolarr", Device="Lolarr Gateway", DeviceId="device-1", Version="0.1.0"',
    )
    expect(buildAuthorizationHeader('device-1', 'tok')).toContain(', Token="tok"')
  })

  it('authenticates by name and sends the device id', async () => {
    let seenAuthHeader = ''
    ctx.jellyfin
      .intercept({
        path: '/Users/AuthenticateByName',
        method: 'POST',
        headers: (headers) => {
          seenAuthHeader = headers.authorization ?? ''
          return true
        },
      })
      .reply(200, jellyfinAuthResponse(), { headers: { 'content-type': 'application/json' } })

    const result = await authenticateByName(ctx.config, {
      username: 'joel',
      password: 'pw',
      deviceId: 'device-1',
    })
    expect(result.accessToken).toBe('jf-access-token')
    expect(result.user).toEqual({ id: 'jf-user-1', name: 'Joel' })
    expect(seenAuthHeader).toContain('DeviceId="device-1"')
    expect(seenAuthHeader).not.toContain('X-Emby')
  })

  it('throws InvalidCredentialsError on 401', async () => {
    ctx.jellyfin
      .intercept({ path: '/Users/AuthenticateByName', method: 'POST' })
      .reply(401, {})
    await expect(
      authenticateByName(ctx.config, { username: 'j', password: 'x', deviceId: 'd' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it('throws UpstreamError on 500', async () => {
    ctx.jellyfin
      .intercept({ path: '/Users/AuthenticateByName', method: 'POST' })
      .reply(500, {})
    await expect(
      authenticateByName(ctx.config, { username: 'j', password: 'x', deviceId: 'd' }),
    ).rejects.toBeInstanceOf(UpstreamError)
  })

  it('runs the quick connect flow', async () => {
    ctx.jellyfin
      .intercept({ path: '/QuickConnect/Initiate', method: 'POST' })
      .reply(200, { Code: '123456', Secret: 'qc-secret' }, { headers: { 'content-type': 'application/json' } })
    ctx.jellyfin
      .intercept({ path: '/QuickConnect/Connect', method: 'GET', query: { secret: 'qc-secret' } })
      .reply(200, { Authenticated: true }, { headers: { 'content-type': 'application/json' } })

    const { code, secret } = await initiateQuickConnect(ctx.config, 'device-1')
    expect(code).toBe('123456')
    const state = await getQuickConnectState(ctx.config, secret, 'device-1')
    expect(state.authenticated).toBe(true)
  })

  it('authorizes a quick connect code with a user token', async () => {
    ctx.jellyfin
      .intercept({ path: '/QuickConnect/Authorize', method: 'POST', query: { code: '123456' } })
      .reply(200, 'true')
    await expect(
      authorizeQuickConnect(ctx.config, '123456', 'user-token', 'device-1'),
    ).resolves.toBeUndefined()
  })
})
