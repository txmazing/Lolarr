import type {
  CreateRequest,
  MediaItem,
  MediaRequest,
  MediaRow,
  MediaType,
  RequestStatus,
  SeasonAvailability,
} from '@lolarr/domain'
import type { AppConfig } from '../config.js'
import { UpstreamError } from '../lib/errors.js'
import type { SeerrSessionService } from '../services/seerrSession.js'

const DISCOVER_CACHE_TTL_MS = 5 * 60 * 1000

export class SeerrAdapter {
  private readonly config: AppConfig
  private readonly sessions: SeerrSessionService
  private discoverCache: { rows: MediaRow[]; fetchedAt: number } | undefined
  private readonly titleCache = new Map<string, string>()

  constructor(config: AppConfig, sessions: SeerrSessionService) {
    this.config = config
    this.sessions = sessions
  }

  async discover(): Promise<MediaRow[]> {
    if (this.discoverCache && Date.now() - this.discoverCache.fetchedAt < DISCOVER_CACHE_TTL_MS) {
      return this.discoverCache.rows
    }

    const [trending, movies, shows] = await Promise.all([
      this.fetchList('/api/v1/discover/trending'),
      this.fetchList('/api/v1/discover/movies'),
      this.fetchList('/api/v1/discover/tv'),
    ])

    const rows = [
      { id: 'trending', title: 'Trending now', items: trending },
      { id: 'popular-movies', title: 'Popular movies', items: movies },
      { id: 'popular-shows', title: 'Popular series', items: shows },
    ].filter((row) => row.items.length > 0)

    this.discoverCache = { rows, fetchedAt: Date.now() }
    return rows
  }

  async search(query: string): Promise<MediaItem[]> {
    const response = await this.request(`/api/v1/search?query=${encodeURIComponent(query)}`)
    return extractItems(response)
  }

  async media(
    mediaType: MediaType,
    tmdbId: number,
  ): Promise<{ item: MediaItem; seasons?: SeasonAvailability[] } | undefined> {
    const path = mediaType === 'movie' ? `/api/v1/movie/${tmdbId}` : `/api/v1/tv/${tmdbId}`

    let response: unknown
    try {
      response = await this.request(path)
    } catch (error) {
      // Seerr answers 404 for titles unknown to TMDB/Seerr — that is "not
      // found", not an upstream failure.
      if (error instanceof UpstreamError && error.status === 404) {
        return undefined
      }
      throw error
    }

    const item = mapSeerrItem(response, mediaType)

    if (!item) {
      return undefined
    }

    if (mediaType === 'movie') {
      return { item }
    }

    return { item, seasons: mapSeasonAvailabilities(response) }
  }

  async requestMedia(userId: string, payload: CreateRequest): Promise<MediaRequest | undefined> {
    const body =
      payload.mediaType === 'movie'
        ? { mediaType: 'movie', mediaId: payload.tmdbId }
        : { mediaType: 'tv', mediaId: payload.tmdbId, seasons: payload.seasons ?? 'all' }

    const response = await this.sessions.fetchWithSession(userId, '/api/v1/request', {
      method: 'POST',
      body,
    })

    this.discoverCache = undefined
    // Seed the title cache so the list refetch right after creating a request
    // does not need a detail round-trip for the new entry.
    const cacheKey = `${payload.mediaType}-${payload.tmdbId}`
    if (!this.titleCache.has(cacheKey)) {
      this.titleCache.set(cacheKey, payload.title)
    }
    const request = mapSeerrRequest(response)
    if (request && !request.title) {
      request.title = payload.title
    }
    return request
  }

  async listRequests(userId: string): Promise<MediaRequest[]> {
    const response = await this.sessions.fetchWithSession(userId, '/api/v1/request?take=50&sort=added')
    const results = isRecord(response) && Array.isArray(response.results) ? response.results : []
    const requests = results
      .map((entry) => mapSeerrRequest(entry))
      .filter((request): request is MediaRequest => request !== undefined)
    await this.fillMissingTitles(requests)
    return requests
  }

  async deleteRequest(userId: string, requestId: string): Promise<void> {
    await this.sessions.fetchWithSession(userId, `/api/v1/request/${encodeURIComponent(requestId)}`, {
      method: 'DELETE',
    })
    this.discoverCache = undefined
  }

  // Seerr's request listing carries no display title; details are fetched once
  // per (mediaType, tmdbId) and cached for the process lifetime (titles are
  // effectively immutable). Failures degrade to the UI's TMDB-id fallback.
  private async fillMissingTitles(requests: MediaRequest[]) {
    const missing = new Map<string, { mediaType: MediaType; tmdbId: number }>()
    for (const request of requests) {
      const key = `${request.mediaType}-${request.tmdbId}`
      if (!request.title && !this.titleCache.has(key)) {
        missing.set(key, { mediaType: request.mediaType, tmdbId: request.tmdbId })
      }
    }

    await Promise.all(
      [...missing.entries()].map(async ([key, target]) => {
        try {
          const detail = await this.media(target.mediaType, target.tmdbId)
          if (detail) {
            this.titleCache.set(key, detail.item.title)
          }
        } catch {
          // best effort — see comment above
        }
      }),
    )

    for (const request of requests) {
      request.title ??= this.titleCache.get(`${request.mediaType}-${request.tmdbId}`)
    }
  }

  private async fetchList(path: string) {
    const response = await this.request(path)
    return extractItems(response)
  }

  private async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers)
    headers.set('X-Api-Key', this.config.SEERR_API_KEY)

    if (init.body) {
      headers.set('Content-Type', 'application/json')
    }

    let response: Response
    try {
      response = await fetch(`${this.config.SEERR_URL}${path}`, {
        ...init,
        headers,
      })
    } catch (error) {
      throw new UpstreamError('seerr', undefined, `Seerr unreachable: ${String(error)}`)
    }

    if (!response.ok) {
      throw new UpstreamError('seerr', response.status, `Seerr request failed: ${response.status}`)
    }

    return response.json() as Promise<unknown>
  }
}

function extractItems(value: unknown): MediaItem[] {
  if (Array.isArray(value)) {
    return value.map((item) => mapSeerrItem(item)).filter(isMediaItem)
  }

  if (isRecord(value)) {
    const results = value.results

    if (Array.isArray(results)) {
      return results.map((item) => mapSeerrItem(item)).filter(isMediaItem)
    }
  }

  return []
}

function mapSeerrItem(value: unknown, fallbackType?: MediaType): MediaItem | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const mediaType = readMediaType(value, fallbackType)
  const tmdbId = readNumber(value, ['id', 'tmdbId', 'mediaId'])
  const title = readString(value, ['title', 'name'])

  if (!mediaType || !tmdbId || !title) {
    return undefined
  }

  const releaseDate = readString(value, ['releaseDate', 'firstAirDate'])
  const year = releaseDate ? Number.parseInt(releaseDate.slice(0, 4), 10) : undefined
  const mediaInfo = isRecord(value.mediaInfo) ? value.mediaInfo : undefined
  const status = readNumber(mediaInfo, ['status'])

  return {
    id: `${mediaType}-${tmdbId}`,
    mediaType,
    title,
    year: Number.isFinite(year) ? year : undefined,
    overview: readString(value, ['overview']) ?? '',
    posterUrl: imageUrl(readString(value, ['posterPath', 'posterUrl'])),
    backdropUrl: imageUrl(readString(value, ['backdropPath', 'backdropUrl']), 'w1280'),
    tmdbId,
    seerrMediaId: readNumber(mediaInfo, ['id']),
    availability: mapSeerrAvailability(status),
  }
}

function readMediaType(value: Record<string, unknown>, fallbackType?: MediaType) {
  const rawType = readString(value, ['mediaType'])

  if (rawType === 'movie' || rawType === 'tv') {
    return rawType
  }

  return fallbackType
}

function readString(value: unknown, keys: string[]) {
  if (!isRecord(value)) {
    return undefined
  }

  for (const key of keys) {
    const candidate = value[key]

    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate
    }
  }

  return undefined
}

function readNumber(value: unknown, keys: string[]) {
  if (!isRecord(value)) {
    return undefined
  }

  for (const key of keys) {
    const candidate = value[key]

    if (typeof candidate === 'number') {
      return candidate
    }
  }

  return undefined
}

function imageUrl(path: string | undefined, size = 'w500') {
  if (!path) {
    return undefined
  }

  if (path.startsWith('http')) {
    return path
  }

  return `https://image.tmdb.org/t/p/${size}${path}`
}

export function mapSeerrAvailability(
  status: number | undefined,
): MediaItem['availability'] {
  switch (status) {
    case 2:
      return 'requested'
    case 3:
      return 'processing'
    case 4:
      return 'partiallyAvailable'
    case 5:
      return 'available'
    case 6:
      return 'unavailable'
    default:
      return 'requestable'
  }
}

export function mapSeerrRequestStatus(
  requestStatus: number | undefined,
  mediaStatus: number | undefined,
): RequestStatus {
  if (requestStatus === 3) {
    return 'declined'
  }
  if (requestStatus === 4) {
    return 'failed'
  }
  if (requestStatus === 2) {
    if (mediaStatus === 5) {
      return 'available'
    }
    if (mediaStatus === 3 || mediaStatus === 4) {
      return 'processing'
    }
    return 'approved'
  }
  return 'pending'
}

export function mapSeerrRequest(value: unknown): MediaRequest | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const media = isRecord(value.media) ? value.media : undefined
  const requestId = readNumber(value, ['id'])
  const tmdbId = readNumber(media, ['tmdbId'])
  const mediaType = readString(media ?? {}, ['mediaType'])

  if (requestId === undefined || tmdbId === undefined || (mediaType !== 'movie' && mediaType !== 'tv')) {
    return undefined
  }

  const status = mapSeerrRequestStatus(readNumber(value, ['status']), readNumber(media, ['status']))
  const requestedBy = isRecord(value.requestedBy) ? value.requestedBy : undefined
  const requestedById = readNumber(requestedBy, ['id'])
  const seasons = Array.isArray(value.seasons)
    ? value.seasons
        .map((season) => (isRecord(season) ? readNumber(season, ['seasonNumber']) : undefined))
        .filter((seasonNumber): seasonNumber is number => typeof seasonNumber === 'number' && seasonNumber > 0)
    : []

  return {
    id: String(requestId),
    mediaType,
    tmdbId,
    title: readString(media, ['title', 'name']),
    status,
    seasons: seasons.length > 0 ? seasons : undefined,
    canCancel: status === 'pending' || status === 'approved',
    requestedBy: {
      id: requestedById !== undefined ? String(requestedById) : 'unknown',
      name: readString(requestedBy ?? {}, ['displayName', 'username', 'email']) ?? 'Unknown user',
    },
    createdAt: readString(value, ['createdAt']) ?? '',
  }
}

export function mapSeasonAvailabilities(value: unknown): SeasonAvailability[] {
  if (!isRecord(value) || !Array.isArray(value.seasons)) {
    return []
  }

  const mediaInfo = isRecord(value.mediaInfo) ? value.mediaInfo : undefined
  const statusBySeason = new Map<number, number>()
  if (mediaInfo && Array.isArray(mediaInfo.seasons)) {
    for (const season of mediaInfo.seasons) {
      if (!isRecord(season)) {
        continue
      }
      const seasonNumber = readNumber(season, ['seasonNumber'])
      const status = readNumber(season, ['status'])
      if (seasonNumber !== undefined && status !== undefined) {
        statusBySeason.set(seasonNumber, status)
      }
    }
  }

  return value.seasons
    .map((season) => {
      if (!isRecord(season)) {
        return undefined
      }
      const seasonNumber = readNumber(season, ['seasonNumber'])
      if (seasonNumber === undefined || seasonNumber <= 0) {
        return undefined
      }
      const name = readString(season, ['name'])
      const result: SeasonAvailability = {
        seasonNumber,
        availability: mapSeerrAvailability(statusBySeason.get(seasonNumber)),
      }
      if (name !== undefined) {
        result.name = name
      }
      return result
    })
    .filter((season): season is SeasonAvailability => season !== undefined)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isMediaItem(value: MediaItem | undefined): value is MediaItem {
  return Boolean(value)
}
