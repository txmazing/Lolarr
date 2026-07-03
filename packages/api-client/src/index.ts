import type {
  CreateRequest,
  DiscoverResponse,
  LoginRequest,
  LoginResponse,
  MediaDetailResponse,
  MediaType,
  RequestsResponse,
  SearchResponse,
  SessionResponse,
} from '@lolarr/domain'

export type LolarrApiClientOptions = {
  baseUrl?: string
  getToken?: () => string | undefined
  onUnauthorized?: () => void
}

export class LolarrApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'LolarrApiError'
    this.status = status
  }
}

export type LolarrApiClient = ReturnType<typeof createLolarrApiClient>

export function createLolarrApiClient({
  baseUrl = '',
  getToken,
  onUnauthorized,
}: LolarrApiClientOptions = {}) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers)
    const token = getToken?.()

    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    })

    if (response.status === 401) {
      onUnauthorized?.()
    }

    if (!response.ok) {
      const payload = await readError(response)
      throw new LolarrApiError(response.status, payload)
    }

    if (response.status === 204) {
      return undefined as T
    }

    return response.json() as Promise<T>
  }

  return {
    login(payload: LoginRequest) {
      return request<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
    session() {
      return request<SessionResponse>('/api/session/me')
    },
    discover() {
      return request<DiscoverResponse>('/api/discover')
    },
    search(query: string) {
      const searchParams = new URLSearchParams({ q: query })
      return request<SearchResponse>(`/api/search?${searchParams}`)
    },
    media(mediaType: MediaType, tmdbId: number) {
      return request<MediaDetailResponse>(`/api/media/${mediaType}/${tmdbId}`)
    },
    createRequest(payload: CreateRequest) {
      return request<RequestsResponse>('/api/requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
    requests() {
      return request<RequestsResponse>('/api/requests')
    },
  }
}

async function readError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string }
    return payload.error ?? response.statusText
  } catch {
    return response.statusText
  }
}
