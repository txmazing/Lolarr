import { afterEach, describe, expect, it, vi } from 'vitest'
import { tizenPlatform } from '../src/tizenPlatform.js'

describe('tizenPlatform', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('does not support volume and exposes media-key registration', () => {
    expect(tizenPlatform.supportsVolume).toBe(false)
    expect(typeof tizenPlatform.registerMediaKeys).toBe('function')
  })

  it('registers only supported media keys and unregisters them on cleanup', () => {
    const registered: string[] = []
    const unregistered: string[] = []
    vi.stubGlobal('tizen', {
      tvinputdevice: {
        getSupportedKeys: () => [
          { name: 'MediaPlay', code: 415 },
          { name: 'MediaPause', code: 19 },
          { name: 'MediaPlayPause', code: 10252 },
          { name: 'MediaStop', code: 413 },
          { name: 'MediaRewind', code: 412 },
          { name: 'MediaFastForward', code: 417 },
        ],
        registerKey: (name: string) => registered.push(name),
        unregisterKey: (name: string) => unregistered.push(name),
      },
    })

    const cleanup = tizenPlatform.registerMediaKeys!()
    expect(registered).toEqual([
      'MediaPlay',
      'MediaPause',
      'MediaPlayPause',
      'MediaStop',
      'MediaRewind',
      'MediaFastForward',
    ])
    cleanup()
    expect(unregistered).toEqual(registered)
  })

  it('skips keys the firmware does not support', () => {
    const registered: string[] = []
    vi.stubGlobal('tizen', {
      tvinputdevice: {
        getSupportedKeys: () => [{ name: 'MediaPlay', code: 415 }],
        registerKey: (name: string) => registered.push(name),
        unregisterKey: () => {},
      },
    })
    tizenPlatform.registerMediaKeys!()
    expect(registered).toEqual(['MediaPlay'])
  })
})
