import { z } from 'zod'

// Deliberately lenient: Seerr's Test button and non-media events post the media
// and request blocks with empty-string fields, so strict typing here would 400 a
// well-formed body. Only genuinely unparseable JSON is a 400; a well-formed but
// incomplete payload is validated in mapWebhookToNotification and becomes a no-op.
export const seerrWebhookSchema = z
  .object({
    notification_type: z.string(),
    subject: z.string().optional(),
    media: z
      .object({
        media_type: z.string().optional(),
        tmdbId: z.union([z.string(), z.number()]).optional(),
        status: z.string().optional(),
      })
      .optional(),
    request: z
      .object({
        request_id: z.string().optional(),
        requestedBy_username: z.string().optional(),
        requestedBy_email: z.string().optional(),
      })
      .optional(),
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

function normalizeMediaType(value: string | undefined): 'movie' | 'tv' | undefined {
  return value === 'movie' || value === 'tv' ? value : undefined
}

function coerceTmdbId(value: string | number | undefined): number | undefined {
  if (value === undefined || value === '') {
    return undefined
  }
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}
