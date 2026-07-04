import { describe, expect, it } from 'vitest'
import { mapWebhookToNotification, seerrWebhookSchema } from '../src/adapters/seerrWebhook.js'

function payload(overrides: Record<string, unknown> = {}) {
  return {
    notification_type: 'MEDIA_AVAILABLE',
    subject: 'Fight Club (1999)',
    media: { media_type: 'movie', tmdbId: '550', status: 'available' },
    request: { request_id: '7', requestedBy_username: 'joel' },
    ...overrides,
  }
}

describe('mapWebhookToNotification', () => {
  it('maps MEDIA_AVAILABLE and coerces tmdbId to a number', () => {
    const result = mapWebhookToNotification(seerrWebhookSchema.parse(payload()))
    expect(result).toEqual({ kind: 'available', tmdbId: 550, mediaType: 'movie', title: 'Fight Club (1999)', username: 'joel' })
  })

  it.each([
    ['MEDIA_APPROVED', 'approved'],
    ['MEDIA_DECLINED', 'declined'],
    ['MEDIA_FAILED', 'failed'],
  ])('maps %s to %s', (type, kind) => {
    const result = mapWebhookToNotification(seerrWebhookSchema.parse(payload({ notification_type: type })))
    expect(result?.kind).toBe(kind)
  })

  it.each(['MEDIA_AUTO_APPROVED', 'MEDIA_PENDING', 'TEST_NOTIFICATION', 'SOMETHING_ELSE'])(
    'returns null for the no-op type %s',
    (type) => {
      expect(mapWebhookToNotification(seerrWebhookSchema.parse(payload({ notification_type: type })))).toBeNull()
    },
  )

  it('returns null when the requesting user is missing', () => {
    expect(mapWebhookToNotification(seerrWebhookSchema.parse(payload({ request: {} })))).toBeNull()
  })

  it('returns null when media or subject is missing', () => {
    expect(mapWebhookToNotification(seerrWebhookSchema.parse(payload({ subject: undefined })))).toBeNull()
    expect(mapWebhookToNotification(seerrWebhookSchema.parse(payload({ media: undefined })))).toBeNull()
  })

  it('ignores unknown extra fields (passthrough)', () => {
    const result = mapWebhookToNotification(seerrWebhookSchema.parse(payload({ image: 'http://x/y.jpg', extra: [] })))
    expect(result?.kind).toBe('available')
  })
})
