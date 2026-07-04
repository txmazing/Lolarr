import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { ErrorPanel, PlayerControls, type ActionComponent } from '@lolarr/ui'
import type { PlaybackSessionHandle, PlayerPlatform } from '@lolarr/player'
import type { KeyValueStorage } from '../storage.js'
import { AutoplayNext } from './AutoplayNext.js'
import { usePlaybackSession } from './usePlaybackSession.js'

const CONTROLS_HIDE_MS = 3000
const PROGRESS_POLL_MS = 500

export function PlayerScreen({
  Action,
  storage,
  platform,
  itemId,
  title,
  resumeTicks,
  seriesId,
  onExit,
  onPlayNext,
}: {
  Action: ActionComponent
  storage: KeyValueStorage
  platform: PlayerPlatform
  itemId: string
  title?: string
  resumeTicks?: number
  seriesId?: string
  onExit: () => void
  onPlayNext: (itemId: string, title?: string) => void
}) {
  const screenRef = useRef<HTMLDivElement>(null)
  const { containerRef, state, errorMessage, handle } = usePlaybackSession({
    storage,
    platform,
    itemId,
    resumeTicks,
  })
  const [controlsVisible, setControlsVisible] = useState(true)
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

  const controlsVisibleRef = useRef(true)
  useEffect(() => {
    controlsVisibleRef.current = controlsVisible
  }, [controlsVisible])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      showControls()
      if (event.key === ' ' || event.keyCode === 10252) {
        event.preventDefault()
        handle.current?.togglePause()
      } else if (event.keyCode === 415) {
        if (state === 'paused') {
          handle.current?.togglePause() // MediaPlay
        }
      } else if (event.keyCode === 19) {
        if (state !== 'paused') {
          handle.current?.togglePause() // MediaPause
        }
      } else if (event.key === 'ArrowLeft' || event.keyCode === 412) {
        handle.current?.seekBy(-10)
      } else if (event.key === 'ArrowRight' || event.keyCode === 417) {
        handle.current?.seekBy(10)
      } else if (event.keyCode === 413) {
        onExit() // MediaStop
      } else if (event.key === 'f' || event.key === 'F') {
        toggleFullscreen()
      } else if (event.key === 'Escape' || event.keyCode === 10009) {
        if (event.key === 'Escape' && document.fullscreenElement) {
          return
        }
        if (controlsVisibleRef.current) {
          setControlsVisible(false)
          return
        }
        onExit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showControls, onExit, handle, state])

  useEffect(() => {
    const unregister = platform.registerMediaKeys?.()
    return () => unregister?.()
  }, [platform])

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
      screenRef.current?.requestFullscreen().catch(() => {
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
    <div ref={screenRef} className="player-screen" onMouseMove={showControls}>
      <div ref={containerRef} className="player-surface" />
      {state === 'loading' ? <div className="player-spinner" aria-label="Loading" /> : null}
      <PlayerControlsContainer
        Action={Action}
        visible={controlsVisible}
        isPaused={state === 'paused'}
        title={title}
        handle={handle}
        showVolume={platform.supportsVolume}
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

/**
 * Owns the position poll and volume state so their frequent updates re-render
 * only the controls, not the whole player screen.
 */
function PlayerControlsContainer({
  Action,
  visible,
  isPaused,
  title,
  handle,
  showVolume,
  onFullscreen,
  onBack,
}: {
  Action: ActionComponent
  visible: boolean
  isPaused: boolean
  title?: string
  handle: RefObject<PlaybackSessionHandle | null>
  showVolume: boolean
  onFullscreen: () => void
  onBack: () => void
}) {
  const [progress, setProgress] = useState({ position: 0, duration: Number.NaN })
  const [volume, setVolume] = useState(1)

  useEffect(() => {
    const progressPoll = setInterval(() => {
      const session = handle.current
      if (session) {
        setProgress(session.getProgress())
      }
    }, PROGRESS_POLL_MS)
    return () => clearInterval(progressPoll)
  }, [handle])

  return (
    <PlayerControls
      Action={Action}
      visible={visible}
      isPaused={isPaused}
      position={progress.position}
      duration={progress.duration}
      volume={volume}
      showVolume={showVolume}
      title={title}
      onTogglePause={() => handle.current?.togglePause()}
      onSeekTo={(seconds) => handle.current?.seekTo(seconds)}
      onSeekBy={(seconds) => handle.current?.seekBy(seconds)}
      onVolume={(value) => {
        setVolume(value)
        handle.current?.setVolume(value)
      }}
      onFullscreen={onFullscreen}
      onBack={onBack}
    />
  )
}
