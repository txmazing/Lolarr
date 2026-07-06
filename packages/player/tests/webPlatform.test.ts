// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { webPlatform } from '../src/webPlatform.js'

describe('webPlatform', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('supports volume and has no media-key registration', () => {
    expect(webPlatform.supportsVolume).toBe(true)
    expect(webPlatform.registerMediaKeys).toBeUndefined()
  })

  it('creates a video element inside the host container and removes it on dispose', () => {
    const container = document.createElement('div')
    const player = webPlatform.createPlayer({ container, token: 't', serverUrl: 'http://jf' })
    const video = container.querySelector('video')
    expect(video).not.toBeNull()
    player.dispose()
    expect(container.querySelector('video')).toBeNull()
  })

  it('builds a device profile named Lolarr Web', () => {
    expect(webPlatform.buildDeviceProfile().Name).toBe('Lolarr Web')
  })
})
