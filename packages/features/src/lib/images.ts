import type { JellyfinSession, MediaItem } from '@lolarr/domain'
import { buildImageUrl } from '@lolarr/jellyfin'

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
      ? buildImageUrl(session, itemId, 'Primary', imageTags.primary, { width: 400 })
      : item.posterUrl,
    backdropUrl: imageTags.backdrop
      ? buildImageUrl(session, itemId, 'Backdrop', imageTags.backdrop, { width: 1280 })
      : item.backdropUrl,
  }
}

export function enrichItems(items: MediaItem[], session: JellyfinSession | null): MediaItem[] {
  return items.map((item) => ({ ...item, ...resolveItemImages(item, session) }))
}
