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
    ['MEDIA_AUTO_APPROVED', 'approved'],
    ['MEDIA_DECLINED', 'declined'],
    ['MEDIA_FAILED', 'failed'],
    ['MEDIA_PENDING', 'requested'],
  ])('maps %s to %s', (type, kind) => {
    const result = mapWebhookToNotification(seerrWebhookSchema.parse(payload({ notification_type: type })))
    expect(result?.kind).toBe(kind)
  })

  it.each(['TEST_NOTIFICATION', 'SOMETHING_ELSE'])(
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

  it('parses and drops a Seerr Test notification with empty media/request fields', () => {
    const testPayload = {
      notification_type: 'TEST_NOTIFICATION',
      subject: 'Test Notification',
      media: { media_type: '', tmdbId: '', status: '' },
      request: { requestedBy_username: '' },
    }
    expect(mapWebhookToNotification(seerrWebhookSchema.parse(testPayload))).toBeNull()
  })

  it('drops a mapped event whose media is present but empty instead of throwing', () => {
    expect(
      mapWebhookToNotification(seerrWebhookSchema.parse(payload({ media: { media_type: '', tmdbId: '' } }))),
    ).toBeNull()
  })

  it('tolerates null media/request/subject/tmdb values without throwing', () => {
    expect(
      mapWebhookToNotification(
        seerrWebhookSchema.parse({ notification_type: 'MEDIA_AVAILABLE', subject: null, media: null, request: null }),
      ),
    ).toBeNull()
    expect(
      mapWebhookToNotification(
        seerrWebhookSchema.parse({
          notification_type: 'MEDIA_AVAILABLE',
          subject: 'X',
          media: { media_type: null, tmdbId: null },
          request: { requestedBy_username: null },
        }),
      ),
    ).toBeNull()
  })

  it.each(['constructor', 'toString', '__proto__'])(
    'returns null for the prototype-chain key %s instead of resolving an inherited member',
    (type) => {
      expect(mapWebhookToNotification(seerrWebhookSchema.parse(payload({ notification_type: type })))).toBeNull()
    },
  )
})
