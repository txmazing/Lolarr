import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildDeviceProfile } from '../src/deviceProfile.js'

type DirectPlayProfile = { Container: string; Type: string; VideoCodec?: string; AudioCodec?: string }
type Profile = {
  MaxStreamingBitrate: number
  DirectPlayProfiles: DirectPlayProfile[]
  TranscodingProfiles: Array<{ Container: string; Protocol: string; VideoCodec: string; AudioCodec: string }>
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('buildDeviceProfile', () => {
  it('falls back to a conservative h264/aac profile without MediaSource', () => {
    const profile = buildDeviceProfile() as Profile
    const video = profile.DirectPlayProfiles.find((p) => p.Type === 'Video')
    expect(video?.VideoCodec).toBe('h264')
    expect(video?.AudioCodec).toContain('aac')
    expect(profile.TranscodingProfiles[0]).toMatchObject({ Protocol: 'hls', VideoCodec: 'h264' })
  })

  it('includes codecs the browser reports as supported', () => {
    vi.stubGlobal('MediaSource', {
      isTypeSupported: (type: string) => type.includes('hvc1') || type.includes('avc1') || type.includes('mp4a'),
    })
    const profile = buildDeviceProfile() as Profile
    const video = profile.DirectPlayProfiles.find((p) => p.Type === 'Video')
    expect(video?.VideoCodec).toContain('hevc')
    expect(video?.VideoCodec).toContain('h264')
    expect(video?.VideoCodec).not.toContain('av1')
  })
})
