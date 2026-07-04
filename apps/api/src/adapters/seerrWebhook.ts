import { z } from 'zod'

// Deliberately lenient: Seerr's Test button and non-media events post the media
// and request blocks with empty-string fields, so strict typing here would 400 a
// well-formed body. Only genuinely unparseable JSON is a 400; a well-formed but
// incomplete payload is validated in mapWebhookToNotification and becomes a no-op.
export const seerrWebhookSchema = z
  .object({
    notification_type: z.string(),
    subject: z.string().nullish(),
    media: z
      .object({
        media_type: z.string().nullish(),
        tmdbId: z.union([z.string(), z.number()]).nullish(),
        status: z.string().nullish(),
      })
      .nullish(),
    request: z
      .object({
        request_id: z.string().nullish(),
        requestedBy_username: z.string().nullish(),
        requestedBy_email: z.string().nullish(),
      })
      .nullish(),
  })
  .passthrough()

export type SeerrWebhookPayload = z.infer<typeof seerrWebhookSchema>

type NotificationKind = 'available' | 'approved' | 'declined' | 'failed'

export type MappedNotification = {
  kind: NotificationKind
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  username: string
}

// MEDIA_AUTO_APPROVED is intentionally omitted: an auto-approved request needs
// no "approved" toast because MEDIA_AVAILABLE follows once it downloads.
const TYPE_TO_KIND: Record<string, NotificationKind | undefined> = {
  MEDIA_AVAILABLE: 'available',
  MEDIA_APPROVED: 'approved',
  MEDIA_DECLINED: 'declined',
  MEDIA_FAILED: 'failed',
}

export function mapWebhookToNotification(payload: SeerrWebhookPayload): MappedNotification | null {
  const kind = Object.hasOwn(TYPE_TO_KIND, payload.notification_type)
    ? TYPE_TO_KIND[payload.notification_type]
    : undefined
  const mediaType = normalizeMediaType(payload.media?.media_type)
  const tmdbId = coerceTmdbId(payload.media?.tmdbId)
  const username = payload.request?.requestedBy_username
  if (!kind || mediaType === undefined || tmdbId === undefined || !payload.subject || !username) {
    return null
  }
  return {
    kind,
    tmdbId,
    mediaType,
    title: payload.subject,
    username,
  }
}

function normalizeMediaType(value: unknown): 'movie' | 'tv' | undefined {
  return value === 'movie' || value === 'tv' ? value : undefined
}

function coerceTmdbId(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : undefined
  }
  if (typeof value === 'string' && value !== '') {
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
  }
  return undefined
}
