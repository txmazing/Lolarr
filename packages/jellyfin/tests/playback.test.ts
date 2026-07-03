import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildStreamSource,
  buildStoppedBeaconPayload,
  getNextUpEpisode,
  getPlaybackInfo,
  JellyfinRequestError,
  reportPlaybackProgress,
  stopActiveEncodings,
} from '../src/playback.js'

const session = { url: 'http://jellyfin.test', accessToken: 'tok', userId: 'u1', deviceId: 'dev1' }
const progressInfo = {
  itemId: 'i1', mediaSourceId: 'ms1', playSessionId: 'ps1',
  positionTicks: 10_000_000, isPaused: false, playMethod: 'DirectPlay' as const,
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('playback api', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts playback info with device profile and auth header', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ PlaySessionId: 'ps1', MediaSources: [
      { Id: 'ms1', Container: 'mkv', SupportsDirectPlay: true, SupportsDirectStream: false },
    ] }))

    const result = await getPlaybackInfo(session, 'i1', {
      deviceProfile: { Name: 'test' },
      startTimeTicks: 5,
      enableDirectPlay: false,
    })

    expect(result.playSessionId).toBe('ps1')
    expect(result.mediaSources[0]).toMatchObject({ id: 'ms1', container: 'mkv', supportsDirectPlay: true })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://jellyfin.test/Items/i1/PlaybackInfo?userId=u1')
    expect((init.headers as Record<string, string>).Authorization).toContain('Token="tok"')
    expect((init.headers as Record<string, string>).Authorization).toContain('DeviceId="dev1"')
    const body = JSON.parse(init.body as string)
    expect(body.DeviceProfile).toEqual({ Name: 'test' })
    expect(body.StartTimeTicks).toBe(5)
    expect(body.EnableDirectPlay).toBe(false)
  })

  it('throws JellyfinRequestError with status on failure', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 401))
    await expect(getPlaybackInfo(session, 'i1', { deviceProfile: {} })).rejects.toMatchObject({ status: 401 })
    fetchMock.mockResolvedValue(jsonResponse({}, 401))
    await expect(getPlaybackInfo(session, 'i1', { deviceProfile: {} })).rejects.toBeInstanceOf(JellyfinRequestError)
  })

  it('builds a direct stream url with api_key query', () => {
    const source = buildStreamSource(session, 'i1', {
      id: 'ms1', container: 'mkv', supportsDirectPlay: true, supportsDirectStream: false, etag: 'e1',
    }, 'ps1')
    expect(source).toEqual({
      kind: 'direct',
      url: 'http://jellyfin.test/Videos/i1/stream.mkv?Static=true&mediaSourceId=ms1&deviceId=dev1&api_key=tok&Tag=e1&playSessionId=ps1',
    })
  })

  it('prefers transcoding url when direct play is not supported', () => {
    const source = buildStreamSource(session, 'i1', {
      id: 'ms1', supportsDirectPlay: false, supportsDirectStream: true,
      transcodingUrl: '/videos/i1/master.m3u8?api_key=tok',
    }, 'ps1')
    expect(source).toEqual({ kind: 'hls', url: 'http://jellyfin.test/videos/i1/master.m3u8?api_key=tok' })
  })

  it('returns null when nothing is playable', () => {
    expect(buildStreamSource(session, 'i1', {
      id: 'ms1', supportsDirectPlay: false, supportsDirectStream: false,
    }, 'ps1')).toBeNull()
  })

  it('reports progress with tick payload', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await reportPlaybackProgress(session, progressInfo)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://jellyfin.test/Sessions/Playing/Progress')
    const body = JSON.parse(init.body as string)
    expect(body).toMatchObject({ ItemId: 'i1', PositionTicks: 10_000_000, IsPaused: false, PlayMethod: 'DirectPlay' })
  })

  it('builds a beacon payload with api_key query', () => {
    const beacon = buildStoppedBeaconPayload(session, progressInfo)
    expect(beacon.url).toBe('http://jellyfin.test/Sessions/Playing/Stopped?api_key=tok')
    expect(JSON.parse(beacon.body)).toMatchObject({ ItemId: 'i1', PlaySessionId: 'ps1' })
  })

  it('stops active encodings with device and session params', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await stopActiveEncodings(session, 'ps1')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://jellyfin.test/Videos/ActiveEncodings?deviceId=dev1&playSessionId=ps1')
    expect((init as RequestInit).method).toBe('DELETE')
  })

  it('fetches the next up episode for a series', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ Items: [
      { Id: 'ep9', Name: 'Next One', ParentIndexNumber: 2, IndexNumber: 3 },
    ] }))
    const next = await getNextUpEpisode(session, 'series-1')
    expect(next).toEqual({ itemId: 'ep9', title: 'Next One', seasonNumber: 2, episodeNumber: 3 })
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe('http://jellyfin.test/Shows/NextUp?seriesId=series-1&userId=u1&limit=1')
  })

  it('returns null when there is no next episode', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ Items: [] }))
    expect(await getNextUpEpisode(session, 'series-1')).toBeNull()
  })
})
