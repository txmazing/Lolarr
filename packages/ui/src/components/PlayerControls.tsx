import { useState } from 'react'
import type { ActionComponent } from './types'

type PlayerControlsProps = {
  Action: ActionComponent
  visible: boolean
  isPaused: boolean
  position: number
  duration: number
  volume: number
  title?: string
  onTogglePause: () => void
  onSeekTo: (seconds: number) => void
  onSeekBy: (seconds: number) => void
  onVolume: (volume: number) => void
  onFullscreen: () => void
  onBack: () => void
}

export function PlayerControls({
  Action,
  visible,
  isPaused,
  position,
  duration,
  volume,
  title,
  onTogglePause,
  onSeekTo,
  onSeekBy,
  onVolume,
  onFullscreen,
  onBack,
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

  return (
    <div className={visible ? 'player-controls visible' : 'player-controls'}>
      <div className="player-controls-top">
        <Action onPress={onBack} focusKey="player-back" ariaLabel="Back">←</Action>
        {title ? <span className="player-title">{title}</span> : null}
      </div>
      <div className="player-controls-bottom">
        <input
          className="player-seekbar"
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
        <div className="player-buttons">
          <Action onPress={() => onSeekBy(-10)} focusKey="player-rewind" ariaLabel="Back 10 seconds">⟲10</Action>
          <Action onPress={onTogglePause} focusKey="player-pause" ariaLabel={isPaused ? 'Play' : 'Pause'}>
            {isPaused ? '▶' : '⏸'}
          </Action>
          <Action onPress={() => onSeekBy(10)} focusKey="player-forward" ariaLabel="Forward 10 seconds">⟳10</Action>
          <span className="player-time">
            {formatTime(position)} / {hasDuration ? formatTime(duration) : '–:––'}
          </span>
          <input
            className="player-volume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(event) => onVolume(Number(event.currentTarget.value))}
            aria-label="Volume"
          />
          <Action onPress={onFullscreen} focusKey="player-fullscreen" ariaLabel="Fullscreen">⛶</Action>
        </div>
      </div>
    </div>
  )
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
