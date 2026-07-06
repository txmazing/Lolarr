import { describe, expect, it } from 'vitest'
import { buildImageUrl, readJellyfinSession } from '../src/index.js'

const session = {
  url: 'http://jellyfin.test',
  accessToken: 'tok',
  userId: 'u1',
  deviceId: 'd1',
}

function storageWith(value: string | null) {
  return { get: () => value }
}

describe('readJellyfinSession', () => {
  it('returns a valid stored session', () => {
    expect(readJellyfinSession(storageWith(JSON.stringify(session)))).toEqual(session)
  })

  it.each([
    ['missing', null],
    ['not json', '{nope'],
    ['wrong shape', JSON.stringify({ url: 'x' })],
  ])('returns null for %s values', (_label, value) => {
    expect(readJellyfinSession(storageWith(value))).toBeNull()
  })
})

describe('buildImageUrl', () => {
  it('builds a primary image url with defaults', () => {
    const url = buildImageUrl(session, 'abc', 'Primary', 'tag1')
    expect(url).toBe('http://jellyfin.test/Items/abc/Images/Primary?tag=tag1&format=Webp&quality=90')
  })

  it('applies width and quality options', () => {
    const url = buildImageUrl(session, 'abc', 'Backdrop', 'tag2', { width: 1280, quality: 80 })
    expect(url).toContain('fillWidth=1280')
    expect(url).toContain('quality=80')
    expect(url).toContain('/Images/Backdrop?')
  })
})
