import type { JellyfinSession, MediaItem } from '@lolarr/domain'
import { buildImageUrl } from '@lolarr/jellyfin'

// Posters render at --card-w (240px CSS). Request device pixels, capped at
// 2x: the TV (DPR 1) decodes 240px instead of the previous fixed 400px.
// Backdrops stay at 1280: the same URL feeds the viewport-wide hero, where
// anything smaller is a visible quality loss (expanded card at 640px CSS
// gets an exact 2x source out of it).
const POSTER_CSS_WIDTH = 240
const BACKDROP_WIDTH = 1280

function posterWidth(): number {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  return Math.round(POSTER_CSS_WIDTH * Math.min(dpr, 2))
}

export function resolveItemImages(
  item: MediaItem,
  session: JellyfinSession | null,
): { posterUrl?: string; backdropUrl?: string } {
  if (!item.jellyfin || !session) {
    return { posterUrl: item.posterUrl, backdropUrl: item.backdropUrl }
  }

  const { itemId, imageTags } = item.jellyfin
  return {
    posterUrl: imageTags.primary
      ? buildImageUrl(session, itemId, 'Primary', imageTags.primary, { width: posterWidth() })
      : item.posterUrl,
    backdropUrl: imageTags.backdrop
      ? buildImageUrl(session, itemId, 'Backdrop', imageTags.backdrop, { width: BACKDROP_WIDTH })
      : item.backdropUrl,
  }
}

export function enrichItems(items: MediaItem[], session: JellyfinSession | null): MediaItem[] {
  return items.map((item) => ({ ...item, ...resolveItemImages(item, session) }))
}
