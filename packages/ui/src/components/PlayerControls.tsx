import { useState } from 'react'
import { cn } from '@ui/lib/utils'
import {
  ArrowLeft,
  SkipBack,
  RotateCcw,
  Play,
  Pause,
  RotateCw,
  SkipForward,
  Heart,
  Captions,
  Music,
  Volume2,
  Settings,
  Maximize,
  Star,
} from '@ui/lib/icons'
import type { ActionComponent } from './types'

// Every control is 44px square and bare (transparent + own blur, hover-fill).
const CONTROL = 'h-11 w-11 p-0 backdrop-blur-[8px]'

const noop = () => {}

type PlayerControlsProps = {
  Action: ActionComponent
  visible: boolean
  isPaused: boolean
  position: number
  duration: number
  volume: number
  showVolume: boolean
  title?: string
  rating?: number
  isFavorite?: boolean
  /** Injected by the call site so `endsAt` stays pure and testable. */
  now?: number
  onTogglePause: () => void
  onSeekTo: (seconds: number) => void
  onSeekBy: (seconds: number) => void
  onVolume: (volume: number) => void
  onFullscreen: () => void
  onBack: () => void
  onNext?: () => void
  onPrev?: () => void
  onToggleFavorite?: () => void
  onSubtitles?: () => void
  onAudio?: () => void
  onSettings?: () => void
}

export function PlayerControls({
  Action,
  visible,
  isPaused,
  position,
  duration,
  volume,
  showVolume,
  title,
  rating,
  isFavorite = false,
  now,
  onTogglePause,
  onSeekTo,
  onSeekBy,
  onVolume,
  onFullscreen,
  onBack,
  onNext,
  onPrev,
  onToggleFavorite,
  onSubtitles,
  onAudio,
  onSettings,
}: PlayerControlsProps) {
  const hasDuration = Number.isFinite(duration) && duration > 0
  // Seek only when the drag ends — seeking per drag increment would fire a
  // network progress report for every tick of the slider.
  const [pendingSeek, setPendingSeek] = useState<number | null>(null)

  function commitSeek(value: number) {
    if (pendingSeek === null) {
      return
    }
    setPendingSeek(null)
    onSeekTo(value)
  }

  const remaining = hasDuration ? `-${formatTime(Math.max(0, duration - position))}` : '-–:––'
  const endsLabel = hasDuration ? endsAt(position, duration, now) : null

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-black/60 via-transparent to-black/75 p-6 opacity-0 transition-opacity duration-300 ease-out-expo',
        visible && 'pointer-events-auto opacity-100',
      )}
    >
      <div className="flex items-center gap-4">
        <Action variant="ghost" onPress={onBack} focusKey="player-back" ariaLabel="Back" className={CONTROL}>
          <ArrowLeft className="size-5" aria-hidden />
        </Action>
        {title ? <span className="text-lg font-semibold">{title}</span> : null}
      </div>

      <div className="flex flex-col gap-3">
        {/* Scrubber row: elapsed · track · remaining (negative) */}
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground tabular-nums text-sm">{formatTime(position)}</span>
          <input
            className="w-full accent-foreground"
            type="range"
            min={0}
            max={hasDuration ? Math.floor(duration) : 0}
            value={pendingSeek ?? Math.floor(position)}
            onChange={(event) => setPendingSeek(Number(event.currentTarget.value))}
            onPointerUp={(event) => commitSeek(Number(event.currentTarget.value))}
            onKeyUp={(event) => commitSeek(Number(event.currentTarget.value))}
            onBlur={(event) => commitSeek(Number(event.currentTarget.value))}
            aria-label="Seek"
          />
          <span className="text-muted-foreground tabular-nums text-sm">{remaining}</span>
        </div>

        {/* Control row: left cluster · right cluster */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* TODO(player): not wired — needs previous-episode navigation */}
            <Action
              variant="ghost"
              onPress={onPrev ?? noop}
              focusKey="player-prev"
              ariaLabel="Previous"
              className={CONTROL}
            >
              <SkipBack className="size-5" aria-hidden />
            </Action>
            <Action
              variant="ghost"
              onPress={() => onSeekBy(-10)}
              focusKey="player-rewind"
              ariaLabel="Back 10 seconds"
              className={CONTROL}
            >
              <RotateCcw className="size-5" aria-hidden />
            </Action>
            <Action
              variant="ghost"
              onPress={onTogglePause}
              focusKey="player-pause"
              ariaLabel={isPaused ? 'Play' : 'Pause'}
              className={CONTROL}
            >
              {isPaused ? <Play className="size-5" aria-hidden /> : <Pause className="size-5" aria-hidden />}
            </Action>
            <Action
              variant="ghost"
              onPress={() => onSeekBy(10)}
              focusKey="player-forward"
              ariaLabel="Forward 10 seconds"
              className={CONTROL}
            >
              <RotateCw className="size-5" aria-hidden />
            </Action>
            {/* TODO(player): not wired — needs next-episode navigation */}
            <Action
              variant="ghost"
              onPress={onNext ?? noop}
              focusKey="player-next"
              ariaLabel="Next"
              className={CONTROL}
            >
              <SkipForward className="size-5" aria-hidden />
            </Action>
            <span className="mx-1 h-6 w-px bg-border" aria-hidden />
            {typeof rating === 'number' ? (
              <span className="flex items-center gap-1 text-sm tabular-nums text-status-pending">
                <Star className="size-4 fill-current" aria-hidden />
                {rating}
              </span>
            ) : null}
            {endsLabel ? <span className="text-muted-foreground text-sm">Endet um {endsLabel}</span> : null}
          </div>

          <div className="flex items-center gap-2">
            <Action
              variant="ghost"
              onPress={onToggleFavorite ?? noop}
              focusKey="player-favorite"
              ariaLabel="Favorite"
              className={CONTROL}
            >
              <Heart
                className={cn('size-5', isFavorite && 'fav-pop fill-current')}
                aria-hidden
              />
            </Action>
            {/* TODO(player): not wired — needs subtitle-track selection sheet */}
            <Action
              variant="ghost"
              onPress={onSubtitles ?? noop}
              focusKey="player-subtitles"
              ariaLabel="Subtitles"
              className={CONTROL}
            >
              <Captions className="size-5" aria-hidden />
            </Action>
            {/* TODO(player): not wired — needs audio-track selection sheet */}
            <Action
              variant="ghost"
              onPress={onAudio ?? noop}
              focusKey="player-audio"
              ariaLabel="Audio"
              className={CONTROL}
            >
              <Music className="size-5" aria-hidden />
            </Action>
            {/* TODO(player): icon not wired — needs a mute toggle; the slider below carries volume */}
            <Action
              variant="ghost"
              onPress={noop}
              focusKey="player-volume"
              ariaLabel="Adjust volume"
              className={CONTROL}
            >
              <Volume2 className="size-5" aria-hidden />
            </Action>
            {showVolume ? (
              <input
                className="w-[110px] accent-foreground"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(event) => onVolume(Number(event.currentTarget.value))}
                aria-label="Volume"
              />
            ) : null}
            {/* TODO(player): not wired — needs playback-settings sheet */}
            <Action
              variant="ghost"
              onPress={onSettings ?? noop}
              focusKey="player-settings"
              ariaLabel="Settings"
              className={CONTROL}
            >
              <Settings className="size-5" aria-hidden />
            </Action>
            <Action
              variant="ghost"
              onPress={onFullscreen}
              focusKey="player-fullscreen"
              ariaLabel="Fullscreen"
              className={CONTROL}
            >
              <Maximize className="size-5" aria-hidden />
            </Action>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Pure clock projection for the "Endet um" label. `now` is injected by the call
 * site (defaulting to `Date.now()` there) so this stays deterministic in tests.
 */
function endsAt(position: number, duration: number, now: number = Date.now()): string {
  const remainingSeconds = Math.max(0, duration - position)
  const end = new Date(now + remainingSeconds * 1000)
  const hh = String(end.getHours()).padStart(2, '0')
  const mm = String(end.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '0:00'
  }
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes)
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}
