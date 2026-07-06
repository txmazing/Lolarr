export type DeviceProfile = Record<string, unknown>

type TypeSupportCheck = (type: string) => boolean

const VIDEO_CODEC_PROBES: Array<{ codec: string; mime: string }> = [
  { codec: 'h264', mime: 'video/mp4; codecs="avc1.42E01E"' },
  { codec: 'hevc', mime: 'video/mp4; codecs="hvc1.1.6.L93.B0"' },
  { codec: 'vp9', mime: 'video/webm; codecs="vp9"' },
  { codec: 'av1', mime: 'video/mp4; codecs="av01.0.04M.08"' },
]

const AUDIO_CODEC_PROBES: Array<{ codec: string; mime: string }> = [
  { codec: 'aac', mime: 'audio/mp4; codecs="mp4a.40.2"' },
  { codec: 'mp3', mime: 'audio/mpeg' },
  { codec: 'ac3', mime: 'audio/mp4; codecs="ac-3"' },
  { codec: 'eac3', mime: 'audio/mp4; codecs="ec-3"' },
  { codec: 'opus', mime: 'audio/webm; codecs="opus"' },
  { codec: 'flac', mime: 'audio/mp4; codecs="flac"' },
]

export function buildDeviceProfile(): DeviceProfile {
  const isSupported = resolveTypeSupport()
  const videoCodecs = probe(VIDEO_CODEC_PROBES, isSupported, ['h264'])
  const audioCodecs = probe(AUDIO_CODEC_PROBES, isSupported, ['aac'])

  return {
    Name: 'Lolarr Web',
    MaxStreamingBitrate: 120_000_000,
    DirectPlayProfiles: [
      {
        Container: 'mp4,m4v,mkv,webm',
        Type: 'Video',
        VideoCodec: videoCodecs.join(','),
        AudioCodec: audioCodecs.join(','),
      },
      { Container: 'mp3,aac,m4a,flac,ogg', Type: 'Audio' },
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

function resolveTypeSupport(): TypeSupportCheck | undefined {
  const mediaSource = (globalThis as { MediaSource?: { isTypeSupported?: TypeSupportCheck } }).MediaSource
  const check = mediaSource?.isTypeSupported
  return check ? check.bind(mediaSource) : undefined
}

function probe(
  probes: Array<{ codec: string; mime: string }>,
  isSupported: TypeSupportCheck | undefined,
  fallback: string[],
): string[] {
  if (!isSupported) {
    return fallback
  }
  const supported = probes.filter((probeEntry) => isSupported(probeEntry.mime)).map((p) => p.codec)
  return supported.length > 0 ? supported : fallback
}
