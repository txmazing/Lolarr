import type { LibraryDetailResponse, MediaItem, Season } from '@lolarr/domain'
import type { AppConfig } from '../config.js'
import { JellyfinTokenInvalidError, UpstreamError } from '../lib/errors.js'
import { jellyfinFetch } from './jellyfin.js'

export type JellyfinUserAuth = {
  accessToken: string
  userId: string
  deviceId: string
}

export type JellyfinView = { id: string; name: string; collectionType?: string }

export type RawJellyfinItem = {
  Id: string
  Name: string
  Type?: string
  ProductionYear?: number
  Overview?: string
  ImageTags?: { Primary?: string; Thumb?: string }
  BackdropImageTags?: string[]
  ProviderIds?: { Tmdb?: string }
  UserData?: { PlayedPercentage?: number; Played?: boolean; PlaybackPositionTicks?: number }
  SeriesName?: string
  SeriesId?: string
  ParentIndexNumber?: number
  IndexNumber?: number
  RunTimeTicks?: number
}

export function mapJellyfinItem(raw: RawJellyfinItem): MediaItem {
  const isEpisode = raw.Type === 'Episode'
  const tmdbRaw = raw.ProviderIds?.Tmdb
  const tmdbId = tmdbRaw ? Number.parseInt(tmdbRaw, 10) : undefined

  return {
    id: `jf-${raw.Id}`,
    mediaType: raw.Type === 'Movie' ? 'movie' : 'tv',
    title: isEpisode ? raw.SeriesName ?? raw.Name : raw.Name,
    year: raw.ProductionYear,
    overview: raw.Overview ?? '',
    tmdbId: Number.isFinite(tmdbId) ? tmdbId : undefined,
    availability: 'available',
    jellyfin: {
      itemId: raw.Id,
      imageTags: {
        primary: raw.ImageTags?.Primary,
        backdrop: raw.BackdropImageTags?.[0],
        thumb: raw.ImageTags?.Thumb,
      },
      progressPercent: raw.UserData?.PlayedPercentage,
      resumePositionTicks: raw.UserData?.PlaybackPositionTicks,
      seriesId: raw.SeriesId,
      episode:
        isEpisode && raw.SeriesName && raw.ParentIndexNumber !== undefined && raw.IndexNumber !== undefined
          ? {
              seriesTitle: raw.SeriesName,
              season: raw.ParentIndexNumber,
              number: raw.IndexNumber,
            }
          : undefined,
    },
  }
}

export async function getUserViews(
  config: AppConfig,
  auth: JellyfinUserAuth,
): Promise<JellyfinView[]> {
  const payload = (await userFetch(
    config,
    auth,
    `/UserViews?userId=${encodeURIComponent(auth.userId)}`,
  )) as { Items?: Array<{ Id: string; Name: string; CollectionType?: string }> }

  return (payload.Items ?? []).map((view) => ({
    id: view.Id,
    name: view.Name,
    collectionType: view.CollectionType,
  }))
}

export async function getResumeItems(
  config: AppConfig,
  auth: JellyfinUserAuth,
  limit: number,
): Promise<MediaItem[]> {
  const payload = (await userFetch(
    config,
    auth,
    `/UserItems/Resume?userId=${encodeURIComponent(auth.userId)}&limit=${limit}&mediaTypes=Video&fields=Overview,ProviderIds`,
  )) as { Items?: RawJellyfinItem[] }
  return (payload.Items ?? []).map(mapJellyfinItem)
}

export async function getNextUp(
  config: AppConfig,
  auth: JellyfinUserAuth,
  limit: number,
): Promise<MediaItem[]> {
  const payload = (await userFetch(
    config,
    auth,
    `/Shows/NextUp?userId=${encodeURIComponent(auth.userId)}&limit=${limit}&fields=Overview,ProviderIds`,
  )) as { Items?: RawJellyfinItem[] }
  return (payload.Items ?? []).map(mapJellyfinItem)
}

export async function getLatestItems(
  config: AppConfig,
  auth: JellyfinUserAuth,
  viewId: string,
  limit: number,
): Promise<MediaItem[]> {
  const payload = (await userFetch(
    config,
    auth,
    `/Items/Latest?userId=${encodeURIComponent(auth.userId)}&parentId=${encodeURIComponent(viewId)}&limit=${limit}&fields=Overview,ProviderIds`,
  )) as RawJellyfinItem[]
  return (Array.isArray(payload) ? payload : []).map(mapJellyfinItem)
}

export async function getLibraryDetail(
  config: AppConfig,
  auth: JellyfinUserAuth,
  itemId: string,
): Promise<LibraryDetailResponse | undefined> {
  const response = await rawUserFetch(
    config,
    auth,
    `/Items/${encodeURIComponent(itemId)}?userId=${encodeURIComponent(auth.userId)}`,
  )
  if (response.status === 404) {
    return undefined
  }
  assertUserOk(response, auth, `/Items/${itemId}`)
  const raw = (await response.json()) as RawJellyfinItem

  const item = mapJellyfinItem(raw)
  if (raw.Type !== 'Series') {
    return { item }
  }

  const seasonsPayload = (await userFetch(
    config,
    auth,
    `/Shows/${encodeURIComponent(itemId)}/Seasons?userId=${encodeURIComponent(auth.userId)}`,
  )) as { Items?: Array<{ Id: string; Name: string }> }

  const seasons: Season[] = []
  for (const season of seasonsPayload.Items ?? []) {
    const episodesPayload = (await userFetch(
      config,
      auth,
      `/Shows/${encodeURIComponent(itemId)}/Episodes?userId=${encodeURIComponent(auth.userId)}&seasonId=${encodeURIComponent(season.Id)}&fields=Overview`,
    )) as { Items?: RawJellyfinItem[] }

    seasons.push({
      id: season.Id,
      name: season.Name,
      episodes: (episodesPayload.Items ?? []).map((episode) => ({
        id: `jf-${episode.Id}`,
        jellyfinItemId: episode.Id,
        title: episode.Name,
        seasonNumber: episode.ParentIndexNumber ?? 0,
        episodeNumber: episode.IndexNumber ?? 0,
        overview: episode.Overview ?? '',
        runtimeMinutes: episode.RunTimeTicks
          ? Math.round(episode.RunTimeTicks / 600_000_000)
          : undefined,
        played: episode.UserData?.Played === true,
        imageTag: episode.ImageTags?.Primary,
        resumePositionTicks: episode.UserData?.PlaybackPositionTicks,
      })),
    })
  }

  return { item, seasons }
}

async function userFetch(config: AppConfig, auth: JellyfinUserAuth, path: string) {
  const response = await rawUserFetch(config, auth, path)
  assertUserOk(response, auth, path)
  return response.json() as Promise<unknown>
}

async function rawUserFetch(config: AppConfig, auth: JellyfinUserAuth, path: string) {
  return jellyfinFetch(config, path, {
    method: 'GET',
    deviceId: auth.deviceId,
    token: auth.accessToken,
  })
}

function assertUserOk(response: Response, auth: JellyfinUserAuth, path: string) {
  if (response.status === 401) {
    throw new JellyfinTokenInvalidError(auth.userId)
  }
  if (!response.ok) {
    throw new UpstreamError('jellyfin', response.status, `Jellyfin request failed: ${path}`)
  }
}
