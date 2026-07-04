import { z } from 'zod'

export const seerrWebhookSchema = z
  .object({
    notification_type: z.string(),
    subject: z.string().optional(),
    media: z
      .object({
        media_type: z.enum(['movie', 'tv']),
        tmdbId: z.coerce.number().int(),
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
  const kind = TYPE_TO_KIND[payload.notification_type]
  const username = payload.request?.requestedBy_username
  if (!kind || !payload.media || !payload.subject || !username) {
    return null
  }
  return {
    kind,
    tmdbId: payload.media.tmdbId,
    mediaType: payload.media.media_type,
    title: payload.subject,
    username,
  }
}
