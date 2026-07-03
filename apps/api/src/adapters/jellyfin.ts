import type { AppConfig } from '../config.js'
import { InvalidCredentialsError, UpstreamError } from '../lib/errors.js'

export type JellyfinAuthResult = {
  user: { id: string; name: string }
  accessToken: string
}

const CLIENT = 'Lolarr'
const DEVICE = 'Lolarr Gateway'
const VERSION = '0.1.0'

export function buildAuthorizationHeader(deviceId: string, token?: string) {
  const base = `MediaBrowser Client="${CLIENT}", Device="${DEVICE}", DeviceId="${deviceId}", Version="${VERSION}"`
  return token ? `${base}, Token="${token}"` : base
}

export async function authenticateByName(
  config: AppConfig,
  input: { username: string; password: string; deviceId: string },
): Promise<JellyfinAuthResult> {
  const response = await jellyfinFetch(config, '/Users/AuthenticateByName', {
    method: 'POST',
    deviceId: input.deviceId,
    body: { Username: input.username, Pw: input.password },
  })

  if (response.status === 401) {
    throw new InvalidCredentialsError()
  }
  assertOk(response, 'Jellyfin login failed')

  return parseAuthResult(await response.json())
}

export async function initiateQuickConnect(config: AppConfig, deviceId: string) {
  const response = await jellyfinFetch(config, '/QuickConnect/Initiate', {
    method: 'POST',
    deviceId,
  })
  assertOk(response, 'Quick Connect initiate failed')

  const payload = (await response.json()) as { Code?: string; Secret?: string }
  if (!payload.Code || !payload.Secret) {
    throw new UpstreamError('jellyfin', response.status, 'Quick Connect response incomplete')
  }
  return { code: payload.Code, secret: payload.Secret }
}

export async function getQuickConnectState(
  config: AppConfig,
  secret: string,
  deviceId: string,
) {
  const response = await jellyfinFetch(
    config,
    `/QuickConnect/Connect?secret=${encodeURIComponent(secret)}`,
    { method: 'GET', deviceId },
  )
  assertOk(response, 'Quick Connect state failed')

  const payload = (await response.json()) as { Authenticated?: boolean }
  return { authenticated: payload.Authenticated === true }
}

export async function authenticateWithQuickConnect(
  config: AppConfig,
  secret: string,
  deviceId: string,
): Promise<JellyfinAuthResult> {
  const response = await jellyfinFetch(config, '/Users/AuthenticateWithQuickConnect', {
    method: 'POST',
    deviceId,
    body: { Secret: secret },
  })
  assertOk(response, 'Quick Connect authentication failed')

  return parseAuthResult(await response.json())
}

export async function authorizeQuickConnect(
  config: AppConfig,
  code: string,
  userAccessToken: string,
  deviceId: string,
): Promise<void> {
  const response = await jellyfinFetch(
    config,
    `/QuickConnect/Authorize?code=${encodeURIComponent(code)}`,
    { method: 'POST', deviceId, token: userAccessToken },
  )

  if (response.status === 401 || response.status === 403) {
    throw new InvalidCredentialsError()
  }
  assertOk(response, 'Quick Connect authorize failed')
}

export async function jellyfinFetch(
  config: AppConfig,
  path: string,
  options: { method: string; deviceId: string; token?: string; body?: unknown },
) {
  const headers: Record<string, string> = {
    Authorization: buildAuthorizationHeader(options.deviceId, options.token),
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  try {
    return await fetch(`${config.JELLYFIN_URL}${path}`, {
      method: options.method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch (error) {
    throw new UpstreamError('jellyfin', undefined, `Jellyfin unreachable: ${String(error)}`)
  }
}

function assertOk(response: Response, message: string) {
  if (!response.ok) {
    throw new UpstreamError('jellyfin', response.status, message)
  }
}

function parseAuthResult(payload: unknown): JellyfinAuthResult {
  const data = payload as { AccessToken?: string; User?: { Id?: string; Name?: string } }
  if (!data.AccessToken || !data.User?.Id || !data.User.Name) {
    throw new UpstreamError('jellyfin', undefined, 'Jellyfin auth response incomplete')
  }
  return {
    user: { id: data.User.Id, name: data.User.Name },
    accessToken: data.AccessToken,
  }
}
