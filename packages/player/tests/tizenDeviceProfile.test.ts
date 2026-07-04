import { describe, expect, it } from 'vitest'
import { buildTizenDeviceProfile, detectTizenYear } from '../src/tizenDeviceProfile.js'

function source(overrides: Partial<{ platformVersion: string; model: string; firmware: string }>) {
  return {
    platformVersion: () => overrides.platformVersion,
    model: () => overrides.model,
    firmware: () => overrides.firmware,
  }
}

describe('detectTizenYear', () => {
  it('prefers the platform version', () => {
    expect(detectTizenYear(source({ platformVersion: '6.0' }))).toBe(2021)
  })

  it('falls back to the model year letter', () => {
    expect(detectTizenYear(source({ model: 'UN55RU8000' }))).toBe(2019)
  })

  it('falls back to a firmware year', () => {
    expect(detectTizenYear(source({ firmware: 'T-KTMAKUC-2024.1' }))).toBe(2024)
  })

  it('uses the conservative default when nothing is known', () => {
    expect(detectTizenYear(source({}))).toBe(2018)
  })
})

describe('buildTizenDeviceProfile', () => {
  it('names the profile and gates hevc to mp4/mkv/ts, never DTS', () => {
    const profile = buildTizenDeviceProfile(source({ platformVersion: '5.0' })) // 2019
    expect(profile.Name).toBe('Lolarr Tizen')
    const videoProfiles = profile.DirectPlayProfiles as Array<{ Container: string; VideoCodec?: string; AudioCodec?: string }>
    const hevcProfile = videoProfiles.find((entry) => entry.VideoCodec?.includes('hevc'))
    expect(hevcProfile?.Container).toBe('mp4,mkv,ts')
    const legacyProfile = videoProfiles.find((entry) => entry.Container === 'm4v,mov,avi')
    expect(legacyProfile?.VideoCodec).toBe('h264')
    for (const entry of videoProfiles) {
      expect(entry.AudioCodec ?? '').not.toMatch(/dts|dca/i)
    }
  })

  it('adds av1 and truehd on newer years', () => {
    const profile = buildTizenDeviceProfile(source({ platformVersion: '6.5' })) // 2022
    const videoProfiles = profile.DirectPlayProfiles as Array<{ Container: string; VideoCodec?: string; AudioCodec?: string }>
    const rich = videoProfiles.find((entry) => entry.Container === 'mp4,mkv,ts')
    expect(rich?.VideoCodec).toContain('av1')
    expect(rich?.AudioCodec).toContain('truehd')
  })
})
