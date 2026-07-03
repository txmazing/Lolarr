import { useCallback, useEffect, useRef, useState } from 'react'
import { ErrorPanel, PlayerControls, type ActionComponent } from '@lolarr/ui'
import type { KeyValueStorage } from '../storage.js'
import { AutoplayNext } from './AutoplayNext.js'
import { usePlaybackSession } from './usePlaybackSession.js'

const CONTROLS_HIDE_MS = 3000

export function PlayerScreen({
  Action,
  storage,
  itemId,
  title,
  resumeTicks,
  seriesId,
  onExit,
  onPlayNext,
}: {
  Action: ActionComponent
  storage: KeyValueStorage
  itemId: string
  title?: string
  resumeTicks?: number
  seriesId?: string
  onExit: () => void
  onPlayNext: (itemId: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { videoRef, state, errorMessage, progress, handle } = usePlaybackSession({
    storage,
    itemId,
    resumeTicks,
  })
  const [controlsVisible, setControlsVisible] = useState(true)
  const [volume, setVolume] = useState(1)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(null)

  const showControls = useCallback(() => {
    setControlsVisible(true)
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
    }
    hideTimer.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    showControls()
    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current)
      }
    }
  }, [showControls])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      showControls()
      if (event.key === ' ') {
        event.preventDefault()
        handle.current?.togglePause()
      } else if (event.key === 'ArrowLeft') {
        handle.current?.seekBy(-10)
      } else if (event.key === 'ArrowRight') {
        handle.current?.seekBy(10)
      } else if (event.key === 'f' || event.key === 'F') {
        toggleFullscreen()
      } else if (event.key === 'Escape') {
        if (document.fullscreenElement) {
          return
        }
        onExit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showControls, onExit, handle])

  useEffect(() => {
    if (state === 'ended' && !seriesId) {
      onExit()
    }
  }, [state, seriesId, onExit])

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {
        // ignore error when exiting fullscreen
      })
    } else {
      containerRef.current?.requestFullscreen().catch(() => {
        // ignore error when entering fullscreen
      })
    }
  }

  if (state === 'error') {
    return (
      <div className="player-screen">
        <ErrorPanel message={errorMessage ?? 'Playback failed'} />
        <Action onPress={onExit} focusKey="player-back">Back</Action>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="player-screen" onMouseMove={showControls}>
      <video ref={videoRef} className="player-video" />
      {state === 'loading' ? <div className="player-spinner" aria-label="Loading" /> : null}
      <PlayerControls
        Action={Action}
        visible={controlsVisible}
        isPaused={state === 'paused'}
        position={progress.position}
        duration={progress.duration}
        volume={volume}
        title={title}
        onTogglePause={() => handle.current?.togglePause()}
        onSeekTo={(seconds) => handle.current?.seekTo(seconds)}
        onSeekBy={(seconds) => handle.current?.seekBy(seconds)}
        onVolume={(value) => {
          setVolume(value)
          if (videoRef.current) {
            videoRef.current.volume = value
          }
        }}
        onFullscreen={toggleFullscreen}
        onBack={onExit}
      />
      {state === 'ended' && seriesId ? (
        <AutoplayNext
          Action={Action}
          storage={storage}
          seriesId={seriesId}
          onPlayNext={onPlayNext}
          onDone={onExit}
        />
      ) : null}
    </div>
  )
}
