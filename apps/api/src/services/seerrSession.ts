import type { AppConfig } from '../config.js'
import { authorizeQuickConnect } from '../adapters/jellyfin.js'
import {
  InvalidCredentialsError,
  JellyfinTokenInvalidError,
  UpstreamError,
} from '../lib/errors.js'
import type { LolarrDatabase } from './database.js'

const GATEWAY_DEVICE_ID = 'lolarr-gateway'

export class SeerrSessionService {
  private cookies: Map<string, string>
  private config: AppConfig
  private database: LolarrDatabase

  constructor(config: AppConfig, database: LolarrDatabase) {
    this.cookies = new Map<string, string>()
    this.config = config
    this.database = database
  }

  async loginWithPassword(userId: string, username: string, password: string) {
    const response = await this.seerrFetch('/api/v1/auth/jellyfin', {
      method: 'POST',
      body: { username, password },
    })
    assertOk(response, 'Seerr jellyfin login failed')
    this.storeCookie(userId, extractSessionCookie(response))
  }

  async ensureSession(userId: string): Promise<string> {
    const cached = this.cookies.get(userId) ?? this.database.getSeerrCookie(userId)
    if (cached) {
      this.cookies.set(userId, cached)
      return cached
    }
    return this.silentQuickConnect(userId)
  }

  async fetchWithSession(
    userId: string,
    path: string,
    init: { method?: string; body?: unknown } = {},
  ): Promise<unknown> {
    let cookie = await this.ensureSession(userId)
    let response = await this.seerrFetch(path, { ...init, cookie })

    if (response.status === 401) {
      this.cookies.delete(userId)
      this.database.clearSeerrCookie(userId)
      cookie = await this.silentQuickConnect(userId)
      response = await this.seerrFetch(path, { ...init, cookie })
    }

    if (!response.ok) {
      throw new UpstreamError('seerr', response.status, await readSeerrErrorMessage(response, path))
    }

    if (response.status === 204) {
      return undefined
    }

    return response.json()
  }

  private async silentQuickConnect(userId: string): Promise<string> {
    const jellyfinToken = this.database.getJellyfinToken(userId)
    if (!jellyfinToken) {
      throw new JellyfinTokenInvalidError(userId)
    }

    const initiate = await this.seerrFetch('/api/v1/auth/jellyfin/quickconnect/initiate', {
      method: 'POST',
    })
    assertOk(initiate, 'Seerr quick connect initiate failed')
    const { code, secret } = (await initiate.json()) as { code?: string; secret?: string }
    if (!code || !secret) {
      throw new UpstreamError('seerr', initiate.status, 'Seerr quick connect response incomplete')
    }

    try {
      await authorizeQuickConnect(this.config, code, jellyfinToken, GATEWAY_DEVICE_ID)
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw new JellyfinTokenInvalidError(userId)
      }
      throw error
    }

    const authenticate = await this.seerrFetch('/api/v1/auth/jellyfin/quickconnect/authenticate', {
      method: 'POST',
      body: { secret },
    })
    assertOk(authenticate, 'Seerr quick connect authenticate failed')

    const cookie = extractSessionCookie(authenticate)
    this.storeCookie(userId, cookie)
    return cookie
  }

  private storeCookie(userId: string, cookie: string) {
    this.cookies.set(userId, cookie)
    this.database.saveSeerrCookie(userId, cookie)
  }

  private async seerrFetch(
    path: string,
    options: { method?: string; body?: unknown; cookie?: string } = {},
  ) {
    const headers: Record<string, string> = {}
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }
    if (options.cookie) {
      headers.Cookie = options.cookie
    }

    try {
      return await fetch(`${this.config.SEERR_URL}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      })
    } catch (error) {
      throw new UpstreamError('seerr', undefined, `Seerr unreachable: ${String(error)}`)
    }
  }
}

function assertOk(response: Response, message: string) {
  if (!response.ok) {
    throw new UpstreamError('seerr', response.status, message)
  }
}

async function readSeerrErrorMessage(response: Response, path: string) {
  try {
    const payload = (await response.json()) as { message?: string; error?: string }
    return payload.message ?? payload.error ?? `Seerr request failed: ${path}`
  } catch {
    return `Seerr request failed: ${path}`
  }
}

function extractSessionCookie(response: Response): string {
  const setCookies = response.headers.getSetCookie()
  const sid = setCookies.find((value) => value.startsWith('connect.sid='))
  if (!sid) {
    throw new UpstreamError('seerr', response.status, 'Seerr login returned no session cookie')
  }
  return sid.split(';')[0] ?? sid
}
