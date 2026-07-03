import type { StreamSource } from '@lolarr/jellyfin'

export type PlayerEvent = 'timeupdate' | 'ended' | 'error' | 'waiting' | 'playing' | 'pause'

export interface Player {
  load(source: StreamSource, opts: { startSeconds?: number }): Promise<void>
  play(): void
  pause(): void
  seek(seconds: number): void
  setVolume(volume: number): void
  getPosition(): number
  getDuration(): number
  isPaused(): boolean
  on(event: PlayerEvent, handler: (detail?: unknown) => void): () => void
  dispose(): void
}
