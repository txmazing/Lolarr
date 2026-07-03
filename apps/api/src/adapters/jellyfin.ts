import type { AppConfig } from '../config.js'
import { InvalidCredentialsError, UpstreamError } from '../lib/errors.js'

export type JellyfinAuthResult = {
  user: {
    id: string
    name: string
  }
  accessToken: string
}

export async function authenticateWithJellyfin(
  config: AppConfig,
  username: string,
  password: string,
): Promise<JellyfinAuthResult> {
  let response: Response
  try {
    response = await fetch(`${config.JELLYFIN_URL}/Users/AuthenticateByName`, {
      method: 'POST',
      headers: {
        Authorization:
          'MediaBrowser Client="Lolarr", Device="Lolarr Gateway", DeviceId="lolarr-gateway", Version="0.1.0"',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Username: username,
        Pw: password,
      }),
    })
  } catch (error) {
    throw new UpstreamError('jellyfin', undefined, `Jellyfin unreachable: ${String(error)}`)
  }

  if (response.status === 401) {
    throw new InvalidCredentialsError()
  }

  if (!response.ok) {
    throw new UpstreamError('jellyfin', response.status, 'Jellyfin login failed')
  }

  const payload = (await response.json()) as {
    AccessToken?: string
    User?: {
      Id?: string
      Name?: string
    }
  }

  if (!payload.AccessToken || !payload.User?.Id || !payload.User.Name) {
    throw new Error('Jellyfin login response was incomplete')
  }

  return {
    user: {
      id: payload.User.Id,
      name: payload.User.Name,
    },
    accessToken: payload.AccessToken,
  }
}
