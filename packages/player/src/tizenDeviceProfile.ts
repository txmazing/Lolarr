import type { DeviceProfile } from './deviceProfile.js'

export type TizenInfoSource = {
  platformVersion(): string | undefined
  model(): string | undefined
  firmware(): string | undefined
}

const DEFAULT_YEAR = 2018

const VERSION_YEAR: Record<string, number> = {
  '2.3': 2015,
  '2.4': 2016,
  '3.0': 2017,
  '4.0': 2018,
  '5.0': 2019,
  '5.5': 2020,
  '6.0': 2021,
  '6.5': 2022,
  '7.0': 2023,
  '8.0': 2024,
  '9.0': 2025,
  '10.0': 2026,
}

const MODEL_YEAR: Record<string, number> = {
  J: 2015,
  K: 2016,
  M: 2017,
  N: 2018,
  R: 2019,
  T: 2020,
  A: 2021,
  B: 2022,
  C: 2023,
  D: 2024,
  E: 2025,
  F: 2026,
}

export function detectTizenYear(source: TizenInfoSource): number {
  return (
    yearFromVersion(source.platformVersion()) ??
    yearFromModel(source.model()) ??
    yearFromFirmware(source.firmware()) ??
    DEFAULT_YEAR
  )
}

export function buildTizenDeviceProfile(source: TizenInfoSource = defaultInfoSource()): DeviceProfile {
  const year = detectTizenYear(source)
  const videoCodecs = videoCodecsForYear(year)
  const audioCodecs = audioCodecsForYear(year)

  return {
    Name: 'Lolarr Tizen',
    MaxStreamingBitrate: 120_000_000,
    DirectPlayProfiles: [
      { Container: 'mp4,mkv,ts', Type: 'Video', VideoCodec: videoCodecs.join(','), AudioCodec: audioCodecs.join(',') },
      { Container: 'm4v,mov,avi', Type: 'Video', VideoCodec: 'h264', AudioCodec: audioCodecs.join(',') },
      { Container: 'webm', Type: 'Video', VideoCodec: year >= 2018 ? 'vp9,vp8' : 'vp8', AudioCodec: 'vorbis,opus' },
      { Container: 'mp3,aac,m4a,flac,ogg,wav', Type: 'Audio' },
    ],
    TranscodingProfiles: [
      {
        Container: 'ts',
        Type: 'Video',
        Protocol: 'hls',
        VideoCodec: 'h264',
        AudioCodec: 'aac',
        Context: 'Streaming',
        MaxAudioChannels: '2',
        MinSegments: 1,
        BreakOnNonKeyFrames: true,
      },
    ],
    SubtitleProfiles: [],
    CodecProfiles: [],
    ResponseProfiles: [],
  }
}

function videoCodecsForYear(year: number): string[] {
  const codecs = ['h264', 'hevc']
  if (year >= 2018) {
    codecs.push('vp9')
  }
  if (year >= 2020) {
    codecs.push('av1')
  }
  return codecs
}

function audioCodecsForYear(year: number): string[] {
  // DTS/DCA is intentionally excluded: unsupported on every Tizen TV year.
  const codecs = ['aac', 'mp3', 'flac', 'vorbis', 'pcm', 'ac3', 'eac3']
  if (year >= 2018) {
    codecs.push('opus')
  }
  if (year >= 2020) {
    codecs.push('truehd')
  }
  return codecs
}

function yearFromVersion(version: string | undefined): number | undefined {
  if (!version) {
    return undefined
  }
  const match = version.match(/^\d+\.\d+/)
  return match ? VERSION_YEAR[match[0]] : undefined
}

function yearFromModel(model: string | undefined): number | undefined {
  if (!model) {
    return undefined
  }
  // QLED / Neo QLED / The Frame: the year letter follows the series token
  // (Q80A, QN90B, LS03B), so a naive "digits then a letter" scan grabs the
  // series letter (Q/LS) instead. Skip the series letter(s) and their digits.
  const qled = model.match(/\d{2}[A-Z]{1,2}\d{2}([A-Z])/)
  if (qled && MODEL_YEAR[qled[1]] !== undefined) {
    return MODEL_YEAR[qled[1]]
  }
  // LED / Crystal UHD (RU8000, NU7100): the year letter sits right after the
  // panel size and is itself followed by the series letter.
  const led = model.match(/\d{2}([A-Z])[A-Z]/)
  if (led && MODEL_YEAR[led[1]] !== undefined) {
    return MODEL_YEAR[led[1]]
  }
  return undefined
}

function yearFromFirmware(firmware: string | undefined): number | undefined {
  if (!firmware) {
    return undefined
  }
  const match = firmware.match(/(20\d{2})/)
  if (!match) {
    return undefined
  }
  const year = Number.parseInt(match[1], 10)
  return year >= 2015 && year <= 2035 ? year : undefined
}

function defaultInfoSource(): TizenInfoSource {
  return {
    platformVersion: () => safe(() => tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version')),
    model: () => safe(() => webapis.productinfo.getRealModel()),
    firmware: () => safe(() => webapis.productinfo.getFirmware()),
  }
}

function safe(read: () => string): string | undefined {
  try {
    const value = read()
    return value.length > 0 ? value : undefined
  } catch {
    return undefined
  }
}
