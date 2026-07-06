import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { MediaItem, MediaRow } from '@lolarr/domain'
import type { AppContext } from '../lib/context.js'
import { GATEWAY_DEVICE_ID } from '../lib/constants.js'
import { JellyfinTokenInvalidError, UpstreamError } from '../lib/errors.js'
import {
  getLatestItems,
  getNextUp,
  getResumeItems,
  getUserViews,
  type JellyfinUserAuth,
} from '../adapters/jellyfinLibrary.js'

const RESUME_LIMIT = 12
const NEXT_UP_LIMIT = 12
const LATEST_LIMIT = 16
const CONTINUE_WATCHING_LIMIT = 12

export async function homeRoutes(app: FastifyInstance, { config, database, seerr }: AppContext) {
  app.get('/api/home', async (request) => {
    const userId = request.session.user.id
    const accessToken = database.getJellyfinToken(userId)
    if (!accessToken) {
      throw new JellyfinTokenInvalidError(userId)
    }
    const auth: JellyfinUserAuth = { accessToken, userId, deviceId: GATEWAY_DEVICE_ID }

    const [resume, nextUp, views, discover] = await Promise.allSettled([
      getResumeItems(config, auth, RESUME_LIMIT),
      getNextUp(config, auth, NEXT_UP_LIMIT),
      getUserViews(config, auth),
      seerr.discover(),
    ])
    rethrowTokenInvalid([resume, nextUp, views])

    const latestRows = await buildLatestRows(request, config, auth, views)

    const continueWatching = mergeContinueWatching(
      settledValue(resume) ?? [],
      settledValue(nextUp) ?? [],
    )

    const rows: MediaRow[] = []
    if (continueWatching.length > 0) {
      rows.push({ id: 'continue-watching', title: 'Continue watching', items: continueWatching })
    }
    rows.push(...latestRows)
    const discoverRows = settledValue(discover) ?? []
    rows.push(...discoverRows)

    // An empty home is only fine when every source responded cleanly (empty).
    // Also covers the edge case: views resolved, but Resume/NextUp/all Latest
    // and Seerr failed — previously this returned 200 {rows:[]}.
    const anySourceRejected = [resume, nextUp, views, discover].some(
      (result) => result.status === 'rejected',
    )
    if (rows.length === 0 && anySourceRejected) {
      throw new UpstreamError('jellyfin', undefined, 'home sources unavailable')
    }
    logRejections(request, { resume, nextUp, views, discover })

    const hero = continueWatching[0] ?? discoverRows[0]?.items[0]
    return { hero, rows }
  })
}

async function buildLatestRows(
  request: FastifyRequest,
  config: AppContext['config'],
  auth: JellyfinUserAuth,
  views: PromiseSettledResult<Awaited<ReturnType<typeof getUserViews>>>,
): Promise<MediaRow[]> {
  if (views.status !== 'fulfilled') {
    return []
  }

  const libraries = views.value.filter(
    (view) => view.collectionType === 'movies' || view.collectionType === 'tvshows',
  )
  const results = await Promise.allSettled(
    libraries.map((library) => getLatestItems(config, auth, library.id, LATEST_LIMIT)),
  )

  const rows: MediaRow[] = []
  results.forEach((result, index) => {
    const library = libraries[index]
    if (!library) {
      return
    }
    if (result.status === 'rejected') {
      if (result.reason instanceof JellyfinTokenInvalidError) {
        throw result.reason
      }
      request.log.warn({ err: result.reason, library: library.name }, 'home latest row failed')
      return
    }
    if (result.value.length > 0) {
      rows.push({
        id: `latest-${library.id}`,
        title: `New in ${library.name}`,
        items: result.value.map(stripProgress),
      })
    }
  })
  return rows
}

// "New in …" shows fresh additions, not re-entry points — Jellyfin's Latest
// returns UserData, but the progress bar belongs on Continue watching only.
function stripProgress(item: MediaItem): MediaItem {
  if (item.jellyfin?.progressPercent === undefined) {
    return item
  }
  const jellyfin = { ...item.jellyfin }
  delete jellyfin.progressPercent
  return { ...item, jellyfin }
}

// Resume first (the server sorts by last played), then NextUp episodes whose
// series is not already in Resume. Dedupe by SeriesId — titles are not unique;
// movies in Resume have no SeriesId and never collide with NextUp episodes.
// Deliberate simplification of Wholphin's last-played lookup merge.
function mergeContinueWatching(resume: MediaItem[], nextUp: MediaItem[]): MediaItem[] {
  const dedupeKey = (item: MediaItem) => item.jellyfin?.seriesId ?? item.id
  const seen = new Set(resume.map(dedupeKey))
  const merged = [...resume]
  for (const item of nextUp) {
    const key = dedupeKey(item)
    if (!seen.has(key)) {
      merged.push(item)
      seen.add(key)
    }
  }
  return merged.slice(0, CONTINUE_WATCHING_LIMIT)
}

function rethrowTokenInvalid(results: Array<PromiseSettledResult<unknown>>) {
  for (const result of results) {
    if (result.status === 'rejected' && result.reason instanceof JellyfinTokenInvalidError) {
      throw result.reason
    }
  }
}

function settledValue<T>(result: PromiseSettledResult<T>): T | undefined {
  return result.status === 'fulfilled' ? result.value : undefined
}

function logRejections(
  request: FastifyRequest,
  results: Record<string, PromiseSettledResult<unknown>>,
) {
  for (const [name, result] of Object.entries(results)) {
    if (result.status === 'rejected') {
      request.log.warn({ err: result.reason, source: name }, 'home source degraded')
    }
  }
}
