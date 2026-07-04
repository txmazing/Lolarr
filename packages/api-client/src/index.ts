import type {
  CreateRequest,
  DiscoverResponse,
  HomeResponse,
  LibraryDetailResponse,
  LoginRequest,
  LoginResponse,
  MediaDetailResponse,
  MediaType,
  QcInitiateResponse,
  QcStateResponse,
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
    home() {
      return request<HomeResponse>('/api/home')
    },
    search(query: string) {
      const searchParams = new URLSearchParams({ q: query })
      return request<SearchResponse>(`/api/search?${searchParams}`)
    },
    media(mediaType: MediaType, tmdbId: number) {
      return request<MediaDetailResponse>(`/api/media/${mediaType}/${tmdbId}`)
    },
    libraryDetail(itemId: string) {
      return request<LibraryDetailResponse>(`/api/library/${encodeURIComponent(itemId)}`)
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
    deleteRequest(requestId: string) {
      return request<RequestsResponse>(`/api/requests/${encodeURIComponent(requestId)}`, {
        method: 'DELETE',
      })
    },
    qcInitiate(payload: { deviceId: string }) {
      return request<QcInitiateResponse>('/api/auth/qc/initiate', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
    qcState(pollToken: string) {
      // POST keeps the token out of the URL, which the API logs verbatim.
      return request<QcStateResponse>('/api/auth/qc/state', {
        method: 'POST',
        body: JSON.stringify({ pollToken }),
      })
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
