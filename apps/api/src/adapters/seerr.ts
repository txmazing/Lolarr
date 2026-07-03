import type { MediaItem, MediaRow, MediaType, RequestStatus } from '@lolarr/domain'
import type { AppConfig } from '../config.js'
import { UpstreamError } from '../lib/errors.js'
import type { SeerrSessionService } from '../services/seerrSession.js'

const DISCOVER_CACHE_TTL_MS = 5 * 60 * 1000

export class SeerrAdapter {
  private readonly config: AppConfig
  private readonly sessions: SeerrSessionService
  private discoverCache: { rows: MediaRow[]; fetchedAt: number } | undefined

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

  async media(mediaType: MediaType, tmdbId: number): Promise<MediaItem | undefined> {
    const response = await this.request(`/api/v1/media/${mediaType}/${tmdbId}`)
    return mapSeerrItem(response, mediaType)
  }

  async requestMedia(
    userId: string,
    mediaType: MediaType,
    tmdbId: number,
  ): Promise<{ status: RequestStatus; seerrRequestId?: string }> {
    const payload =
      mediaType === 'movie'
        ? { mediaType, mediaId: tmdbId }
        : { mediaType, mediaId: tmdbId, seasons: 'all' }

    const response = await this.sessions.fetchWithSession(userId, '/api/v1/request', {
      method: 'POST',
      body: payload,
    })

    const requestId = readNumber(response, ['id', 'requestId'])
    this.discoverCache = undefined
    return {
      status: 'pending',
      seerrRequestId: requestId ? String(requestId) : undefined,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isMediaItem(value: MediaItem | undefined): value is MediaItem {
  return Boolean(value)
}
