import type { JellyfinSession } from '@lolarr/domain'

export class JellyfinRequestError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'JellyfinRequestError'
    this.status = status
  }
}

export type MediaSourceInfo = {
  id: string
  container?: string
  supportsDirectPlay: boolean
  supportsDirectStream: boolean
  transcodingUrl?: string
  etag?: string
}

export type PlaybackInfoResult = {
  playSessionId: string
  mediaSources: MediaSourceInfo[]
}

export type StreamSource = { url: string; kind: 'direct' | 'hls' }

export type PlaybackProgressInfo = {
  itemId: string
  mediaSourceId: string
  playSessionId: string
  positionTicks: number
  isPaused: boolean
  playMethod: 'DirectPlay' | 'Transcode'
}

export type NextUpEpisode = {
  itemId: string
  title: string
  seasonNumber?: number
  episodeNumber?: number
}

const CLIENT = 'Lolarr'
const DEVICE = 'Lolarr Web'
const VERSION = '0.1.0'

function authorizationHeader(session: JellyfinSession) {
  return `MediaBrowser Client="${CLIENT}", Device="${DEVICE}", DeviceId="${session.deviceId}", Version="${VERSION}", Token="${session.accessToken}"`
}

async function jellyfinRequest(
  session: JellyfinSession,
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<Response> {
  const headers: Record<string, string> = { Authorization: authorizationHeader(session) }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${session.url}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    throw new JellyfinRequestError(response.status, `Jellyfin request failed: ${path}`)
  }
  return response
}

export async function getPlaybackInfo(
  session: JellyfinSession,
  itemId: string,
  opts: {
    deviceProfile: unknown
    startTimeTicks?: number
    maxStreamingBitrate?: number
    enableDirectPlay?: boolean
  },
): Promise<PlaybackInfoResult> {
  const response = await jellyfinRequest(
    session,
    `/Items/${encodeURIComponent(itemId)}/PlaybackInfo?userId=${encodeURIComponent(session.userId)}`,
    {
      method: 'POST',
      body: {
        DeviceProfile: opts.deviceProfile,
        StartTimeTicks: opts.startTimeTicks,
        MaxStreamingBitrate: opts.maxStreamingBitrate,
        EnableDirectPlay: opts.enableDirectPlay,
        AutoOpenLiveStream: true,
      },
    },
  )

  const payload = (await response.json()) as {
    PlaySessionId?: string
    MediaSources?: Array<{
      Id: string
      Container?: string
      SupportsDirectPlay?: boolean
      SupportsDirectStream?: boolean
      TranscodingUrl?: string
      ETag?: string
    }>
  }

  return {
    playSessionId: payload.PlaySessionId ?? '',
    mediaSources: (payload.MediaSources ?? []).map((source) => ({
      id: source.Id,
      container: source.Container,
      supportsDirectPlay: source.SupportsDirectPlay === true,
      supportsDirectStream: source.SupportsDirectStream === true,
      transcodingUrl: source.TranscodingUrl,
      etag: source.ETag,
    })),
  }
}

export function buildStreamSource(
  session: JellyfinSession,
  itemId: string,
  source: MediaSourceInfo,
  playSessionId: string,
): StreamSource | null {
  if (source.supportsDirectPlay && source.container) {
    const params = new URLSearchParams({
      Static: 'true',
      mediaSourceId: source.id,
      deviceId: session.deviceId,
      api_key: session.accessToken,
    })
    if (source.etag) {
      params.set('Tag', source.etag)
    }
    params.set('playSessionId', playSessionId)
    return {
      kind: 'direct',
      url: `${session.url}/Videos/${encodeURIComponent(itemId)}/stream.${source.container}?${params.toString()}`,
    }
  }

  if (source.transcodingUrl) {
    return { kind: 'hls', url: `${session.url}${source.transcodingUrl}` }
  }

  return null
}

function progressBody(info: PlaybackProgressInfo) {
  return {
    ItemId: info.itemId,
    MediaSourceId: info.mediaSourceId,
    PlaySessionId: info.playSessionId,
    PositionTicks: info.positionTicks,
    IsPaused: info.isPaused,
    PlayMethod: info.playMethod,
  }
}

export async function reportPlaybackStart(session: JellyfinSession, info: PlaybackProgressInfo) {
  await jellyfinRequest(session, '/Sessions/Playing', { method: 'POST', body: progressBody(info) })
}

export async function reportPlaybackProgress(session: JellyfinSession, info: PlaybackProgressInfo) {
  await jellyfinRequest(session, '/Sessions/Playing/Progress', { method: 'POST', body: progressBody(info) })
}

export async function reportPlaybackStopped(session: JellyfinSession, info: PlaybackProgressInfo) {
  await jellyfinRequest(session, '/Sessions/Playing/Stopped', { method: 'POST', body: progressBody(info) })
}

// sendBeacon kann keine Header setzen — Token als Query-Param.
export function buildStoppedBeaconPayload(session: JellyfinSession, info: PlaybackProgressInfo) {
  return {
    url: `${session.url}/Sessions/Playing/Stopped?api_key=${encodeURIComponent(session.accessToken)}`,
    body: JSON.stringify(progressBody(info)),
  }
}

export async function stopActiveEncodings(session: JellyfinSession, playSessionId: string) {
  const params = new URLSearchParams({ deviceId: session.deviceId, playSessionId })
  await jellyfinRequest(session, `/Videos/ActiveEncodings?${params.toString()}`, { method: 'DELETE' })
}

export async function getNextUpEpisode(
  session: JellyfinSession,
  seriesId: string,
): Promise<NextUpEpisode | null> {
  const params = new URLSearchParams({ seriesId, userId: session.userId, limit: '1' })
  const response = await jellyfinRequest(session, `/Shows/NextUp?${params.toString()}`)
  const payload = (await response.json()) as {
    Items?: Array<{ Id: string; Name: string; ParentIndexNumber?: number; IndexNumber?: number }>
  }
  const item = payload.Items?.[0]
  if (!item) {
    return null
  }
  return {
    itemId: item.Id,
    title: item.Name,
    seasonNumber: item.ParentIndexNumber,
    episodeNumber: item.IndexNumber,
  }
}
