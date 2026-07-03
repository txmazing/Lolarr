import {
  demoRows,
  findDemoItem,
  searchDemoItems,
  type MediaItem,
  type MediaRow,
  type MediaType,
  type RequestStatus,
} from '@lolarr/domain'
import type { AppConfig } from '../config.js'

export class SeerrAdapter {
  private readonly config: AppConfig

  constructor(config: AppConfig) {
    this.config = config
  }

  async discover(): Promise<MediaRow[]> {
    if (!this.isConfigured()) {
      return demoRows
    }

    try {
      const [trending, movies, shows] = await Promise.all([
        this.fetchList('/api/v1/discover/trending'),
        this.fetchList('/api/v1/discover/movies'),
        this.fetchList('/api/v1/discover/tv'),
      ])

      return [
        { id: 'trending', title: 'Trending now', items: trending },
        { id: 'popular-movies', title: 'Popular movies', items: movies },
        { id: 'popular-shows', title: 'Popular series', items: shows },
      ].filter((row) => row.items.length > 0)
    } catch {
      return demoRows
    }
  }

  async search(query: string): Promise<MediaItem[]> {
    if (!this.isConfigured()) {
      return searchDemoItems(query)
    }

    try {
      const response = await this.request(`/api/v1/search?query=${encodeURIComponent(query)}`)
      return extractItems(response)
    } catch {
      return searchDemoItems(query)
    }
  }

  async media(mediaType: MediaType, tmdbId: number): Promise<MediaItem | undefined> {
    if (!this.isConfigured()) {
      return findDemoItem(mediaType, tmdbId)
    }

    try {
      const response = await this.request(`/api/v1/media/${mediaType}/${tmdbId}`)
      return mapSeerrItem(response, mediaType)
    } catch {
      return findDemoItem(mediaType, tmdbId)
    }
  }

  async requestMedia(mediaType: MediaType, tmdbId: number): Promise<{
    status: RequestStatus
    seerrRequestId?: string
  }> {
    if (!this.isConfigured()) {
      return { status: 'pending' }
    }

    const payload =
      mediaType === 'movie'
        ? { mediaType, mediaId: tmdbId }
        : { mediaType, mediaId: tmdbId, seasons: 'all' }

    const response = await this.request('/api/v1/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    const requestId = readNumber(response, ['id', 'requestId'])

    return {
      status: 'pending',
      seerrRequestId: requestId ? String(requestId) : undefined,
    }
  }

  private isConfigured() {
    return Boolean(this.config.SEERR_URL && this.config.SEERR_API_KEY)
  }

  private async fetchList(path: string) {
    const response = await this.request(path)
    return extractItems(response)
  }

  private async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers)
    headers.set('X-Api-Key', this.config.SEERR_API_KEY ?? '')

    if (init.body) {
      headers.set('Content-Type', 'application/json')
    }

    const response = await fetch(`${this.config.SEERR_URL}${path}`, {
      ...init,
      headers,
    })

    if (!response.ok) {
      throw new Error(`Seerr request failed: ${response.status}`)
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
    availability: mapAvailability(status),
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

function mapAvailability(status: number | undefined): MediaItem['availability'] {
  if (status === 5) {
    return 'available'
  }

  if (status === 3 || status === 4) {
    return 'processing'
  }

  if (status === 2) {
    return 'requested'
  }

  return 'requestable'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isMediaItem(value: MediaItem | undefined): value is MediaItem {
  return Boolean(value)
}
