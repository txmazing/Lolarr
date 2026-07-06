import { jellyfinSessionSchema, type JellyfinSession } from '@lolarr/domain'

const jellyfinStorageKey = 'lolarr.jellyfin'

export type SessionStorageReader = { get(key: string): string | null }

export function readJellyfinSession(storage: SessionStorageReader): JellyfinSession | null {
  const raw = storage.get(jellyfinStorageKey)
  if (!raw) {
    return null
  }

  try {
    const parsed = jellyfinSessionSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export type JellyfinImageType = 'Primary' | 'Backdrop' | 'Thumb'

export function buildImageUrl(
  session: JellyfinSession,
  itemId: string,
  type: JellyfinImageType,
  tag: string,
  opts: { width?: number; quality?: number } = {},
): string {
  const params = new URLSearchParams({ tag, format: 'Webp', quality: String(opts.quality ?? 90) })
  if (opts.width) {
    params.set('fillWidth', String(opts.width))
  }
  return `${session.url}/Items/${encodeURIComponent(itemId)}/Images/${type}?${params.toString()}`
}

export * from './playback.js'
